import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose, { Types } from 'mongoose';
import { Order } from '../models/Order';
import { OrderOffer } from '../models/OrderOffer';
import { SystemLandmark } from '../models/SystemLandmark';
import { DriverLocation, transitionStaleDrivers } from '../models/DriverLocation';
import { DriverProfile } from '../models/DriverProfile';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import { ORDER_FSM } from '../config/stateMachine';
import { MatchingEngine, CandidateDriverInput } from './MatchingEngine';
import { LandmarkService } from './LandmarkService';
import { OrderService } from './OrderService';
import { OrderController } from '../controllers/OrderController';
import { DispatchService } from './DispatchService';
import { WalletService } from './WalletService';
import { InternalAccount } from '../config/accounts';
import * as socketInstance from '../socketInstance';

describe('Phase 4 — Pre-Dispatching & Operational Intelligence', () => {
  it('ORDER_FSM permits PENDING -> CHAINED_RESERVED -> ACCEPTED transitions', () => {
    assert.ok(ORDER_FSM[OrderStatus.PENDING].includes(OrderStatus.CHAINED_RESERVED));
    assert.ok(ORDER_FSM[OrderStatus.CHAINED_RESERVED].includes(OrderStatus.ACCEPTED));
    assert.ok(ORDER_FSM[OrderStatus.CHAINED_RESERVED].includes(OrderStatus.CANCELLED));
  });

  it('MatchingEngine EAT formula: higher acceptance rate produces higher EAT score', () => {
    const etaMinutes = 4.0;
    const remainingActive = 2.0;

    // Driver 1: Highly responsive (90% acceptance rate)
    const responsive = MatchingEngine.computeEatScore(etaMinutes, 0.9, true, remainingActive);
    // Driver 2: Low responsiveness (20% acceptance rate)
    const unresponsive = MatchingEngine.computeEatScore(etaMinutes, 0.2, true, remainingActive);

    assert.ok(responsive.eatMinutes <= unresponsive.eatMinutes, 'Responsive driver should have lower/faster EAT');
    assert.ok(responsive.eatScore >= unresponsive.eatScore, 'Responsive driver should have higher EAT score');
  });

  it('Finishing-Soon Discovery: driver at ARRIVED_AT_DROPOFF is included with virtual origin', async () => {
    const finishingDriverId = new mongoose.Types.ObjectId();
    const pickupCoords: [number, number] = [45.3182, 2.0469];
    const dropoffCoords: [number, number] = [45.3200, 2.0480]; // ~300m away

    const originalOrderFind = Order.find;
    const originalDriverProfileFind = DriverProfile.find;
    const originalDriverLocationFind = DriverLocation.find;
    const originalGeoFind = (await import('./GeoTrackingService')).GeoTrackingService.findNearbyDrivers;

    try {
      (Order.find as any) = (query: any) => {
        if (query.status?.$in?.includes(OrderStatus.ARRIVED_AT_DROPOFF)) {
          return {
            select: () => [
              {
                driverId: finishingDriverId,
                status: OrderStatus.ARRIVED_AT_DROPOFF,
                dropoffLocation: { coordinates: dropoffCoords },
              },
            ],
          };
        }
        if (query.status === OrderStatus.CHAINED_RESERVED) {
          return { select: () => [] };
        }
        return { select: () => [] };
      };

      (DriverLocation.find as any) = (query: any) => ({
        select: () => [
          {
            userId: finishingDriverId,
            heading: 90,
            speed: 0,
            connectivityState: 'ACTIVE',
          },
        ],
      });

      (DriverProfile.find as any) = () => ({
        select: () => [{ userId: finishingDriverId }],
      });

      const candidates = await DispatchService.findCandidates({
        pickupCoordinates: pickupCoords,
        vehicleType: 'car',
        radiusInMeters: 5000,
      });

      assert.ok(
        candidates.includes(finishingDriverId.toString()),
        'Finishing soon driver should be included as a candidate via virtual origin'
      );
    } finally {
      Order.find = originalOrderFind;
      DriverProfile.find = originalDriverProfileFind;
      DriverLocation.find = originalDriverLocationFind;
    }
  });

  it('Capacity Guard: driver holding an active delivery AND a chained delivery is excluded', async () => {
    const maxedDriverId = new mongoose.Types.ObjectId();
    const pickupCoords: [number, number] = [45.3182, 2.0469];

    const originalOrderFind = Order.find;
    const originalDriverProfileFind = DriverProfile.find;

    try {
      (Order.find as any) = (query: any) => {
        if (query.status === OrderStatus.CHAINED_RESERVED) {
          return {
            select: () => [{ driverId: maxedDriverId }],
          };
        }
        return { select: () => [] };
      };

      (DriverProfile.find as any) = () => ({
        select: () => [],
      });

      const candidates = await DispatchService.findCandidates({
        pickupCoordinates: pickupCoords,
        vehicleType: 'car',
        radiusInMeters: 5000,
      });

      assert.ok(
        !candidates.includes(maxedDriverId.toString()),
        'Driver already holding CHAINED_RESERVED order must be excluded from candidate matching'
      );
    } finally {
      Order.find = originalOrderFind;
      DriverProfile.find = originalDriverProfileFind;
    }
  });

  it('Chained Acceptance: order transitions to CHAINED_RESERVED when accepted by finishing-soon driver', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    let updatedStatus: any = null;
    let isChainedRecorded = false;

    const originalSession = mongoose.startSession;
    const originalFindOneOrder = Order.findOne;
    const originalFindOneAndUpdate = Order.findOneAndUpdate;
    const originalFindOneOffer = OrderOffer.findOne;
    const { Idempotency } = await import('../models/Idempotency');
    const originalIdempotencyFindOne = Idempotency.findOne;
    const originalIdempotencyCreate = Idempotency.create;

    try {
      (Idempotency as any).findOne = async () => null;
      (Idempotency as any).create = async () => ({});

      (mongoose as any).startSession = async () => ({
        withTransaction: async (cb: any) => cb(),
        endSession: () => {},
      });

      // Offer gate passes
      (OrderOffer as any).findOne = () => ({
        session: () => ({
          _id: new mongoose.Types.ObjectId(),
          status: 'SENT',
          expiresAt: new Date(Date.now() + 15000),
          save: async () => {},
        }),
      });

      (OrderOffer as any).find = () => ({
        session: () => [],
      });

      // Driver has an active order (ARRIVED_AT_DROPOFF)
      (Order as any).findOne = (query: any) => ({
        session: () => ({
          _id: new mongoose.Types.ObjectId(),
          driverId,
          status: OrderStatus.ARRIVED_AT_DROPOFF,
        }),
      });

      (Order as any).findOneAndUpdate = (_query: any, update: any) => {
        updatedStatus = update.$set?.status;
        isChainedRecorded = update.$set?.isChained;
        return {
          _id: orderId,
          status: update.$set?.status,
          customerId: new mongoose.Types.ObjectId(),
          toObject: () => ({}),
        };
      };

      const req: any = {
        params: { id: orderId.toString() },
        body: {},
        user: { userId: driverId.toString() },
        idempotencyKey: 'idemp-chained-accept-1',
        id: 'req-chain-1',
      };

      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (data: any) => data };
        },
      };

      await OrderController.accept(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(updatedStatus, OrderStatus.CHAINED_RESERVED, 'Order must transition to CHAINED_RESERVED');
      assert.strictEqual(isChainedRecorded, true, 'isChained flag must be true');
    } finally {
      mongoose.startSession = originalSession;
      Order.findOne = originalFindOneOrder;
      Order.findOneAndUpdate = originalFindOneAndUpdate;
      OrderOffer.findOne = originalFindOneOffer;
      Idempotency.findOne = originalIdempotencyFindOne;
      Idempotency.create = originalIdempotencyCreate;
    }
  });

  it('Auto-Activation: completing delivery of primary order flips chained order from CHAINED_RESERVED to ACCEPTED', async () => {
    const primaryOrderId = new mongoose.Types.ObjectId();
    const chainedOrderId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    let chainedOrderActivated = false;
    let socketChainedEmitted = false;

    const originalSession = mongoose.startSession;
    const originalFindById = Order.findById;
    const originalFindOne = Order.findOne;
    const originalTransferFunds = WalletService.transferFunds;

    try {
      (mongoose as any).startSession = async () => ({
        startTransaction: () => {},
        commitTransaction: async () => {},
        abortTransaction: async () => {},
        endSession: () => {},
      });

      const primaryOrder: any = {
        _id: primaryOrderId,
        driverId,
        customerId: new mongoose.Types.ObjectId(),
        status: OrderStatus.ARRIVED_AT_DROPOFF,
        verificationPin: '1234',
        paymentSettled: false,
        price: 20,
        commission: 3,
        save: async () => {},
      };

      (Order as any).findById = () => ({
        session: () => ({
          select: () => primaryOrder,
        }),
      });

      const chainedOrderMock: any = {
        _id: chainedOrderId,
        customerId: new mongoose.Types.ObjectId(),
        driverId,
        status: OrderStatus.CHAINED_RESERVED,
        isChained: true,
        save: async function () {
          if (this.status === OrderStatus.ACCEPTED && this.isChained === false) {
            chainedOrderActivated = true;
          }
        },
      };

      (Order as any).findOne = (query: any) => ({
        session: () => {
          if (query.status === OrderStatus.CHAINED_RESERVED) {
            return chainedOrderMock;
          }
          return null;
        },
      });

      (WalletService as any).transferFunds = async () => ({});

      socketInstance.registerSocketService({
        io: {
          to: (_room: string) => ({
            emit: (event: string, _data: any) => {
              if (event === 'chained_order_activated') {
                socketChainedEmitted = true;
              }
            },
          }),
        },
      } as any);

      await OrderService.verifyAndSettle(primaryOrderId.toString(), '1234', driverId.toString());

      assert.strictEqual(chainedOrderActivated, true, 'Chained order should be promoted to ACCEPTED');
      assert.strictEqual(socketChainedEmitted, true, 'Driver should receive chained_order_activated socket event');
    } finally {
      mongoose.startSession = originalSession;
      Order.findById = originalFindById;
      Order.findOne = originalFindOne;
      WalletService.transferFunds = originalTransferFunds;
    }
  });

  it('Landmark Feedback: Pin Accurate: Yes increases confidence (+5), No decreases (-10)', async () => {
    const landmarkId = new mongoose.Types.ObjectId();
    let currentScore = 50;

    const originalFindByIdAndUpdate = SystemLandmark.findByIdAndUpdate;
    const originalFindById = SystemLandmark.findById;

    try {
      (SystemLandmark as any).findByIdAndUpdate = async (_id: any, _update: any) => ({});
      (SystemLandmark as any).findById = async () => ({
        _id: landmarkId,
        confidenceScore: currentScore,
        save: async function () {
          currentScore = this.confidenceScore;
        },
      });

      // 1. Submit Yes (+5)
      await LandmarkService.recordFeedback(landmarkId.toString(), true);
      assert.strictEqual(currentScore, 55, 'Confidence score should increase by 5 on Yes');

      // 2. Submit No (-10)
      await LandmarkService.recordFeedback(landmarkId.toString(), false);
      assert.strictEqual(currentScore, 45, 'Confidence score should decrease by 10 on No');
    } finally {
      SystemLandmark.findByIdAndUpdate = originalFindByIdAndUpdate;
      SystemLandmark.findById = originalFindById;
    }
  });

  it('Heartbeat Sweep: transitionStaleDrivers transitions stale drivers across connectivity states', async () => {
    let offlineQueryCaptured = false;
    let staleQueryCaptured = false;
    let graceQueryCaptured = false;

    const originalUpdateMany = DriverLocation.updateMany;

    try {
      (DriverLocation as any).updateMany = async (query: any, update: any) => {
        if (update.$set?.connectivityState === 'OFFLINE') {
          offlineQueryCaptured = true;
          return { modifiedCount: 3 };
        }
        if (update.$set?.connectivityState === 'STALE') {
          staleQueryCaptured = true;
          return { modifiedCount: 2 };
        }
        if (update.$set?.connectivityState === 'GRACE_PERIOD') {
          graceQueryCaptured = true;
          return { modifiedCount: 1 };
        }
        return { modifiedCount: 0 };
      };

      const result = await transitionStaleDrivers();

      assert.strictEqual(offlineQueryCaptured, true, 'Drivers beyond threshold must transition to OFFLINE');
      assert.strictEqual(staleQueryCaptured, true, 'Drivers between thresholds must transition to STALE');
      assert.strictEqual(graceQueryCaptured, true, 'Drivers in grace window must transition to GRACE_PERIOD');
      assert.strictEqual(result.markedOffline, 3);
      assert.strictEqual(result.markedStale, 2);
      assert.strictEqual(result.markedGrace, 1);
    } finally {
      DriverLocation.updateMany = originalUpdateMany;
    }
  });
});
