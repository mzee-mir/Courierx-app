import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { OrderOffer, IOrderOffer } from '../models/OrderOffer';
import { Order } from '../models/Order';
import { DriverProfile } from '../models/DriverProfile';
import { DispatchService } from './DispatchService';
import { OrderController } from '../controllers/OrderController';
import { WalletService } from './WalletService';
import { InternalAccount } from '../config/accounts';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import * as socketInstance from '../socketInstance';

describe('Dispatch Lifecycle & Multi-Round Offer Batching', () => {
  it('validates OrderOffer model schema with score breakdown and expiresAt', () => {
    const offer = new OrderOffer({
      orderId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      roundNumber: 1,
      status: 'SENT',
      score: 87.5,
      scoreBreakdown: {
        etaMinutes: 4.2,
        etaScore: 80,
        landmarkScore: 75,
        headingScore: 100,
        idleScore: 80,
        acceptanceScore: 90,
      },
      expiresAt: new Date(Date.now() + 15000),
    });

    const err = offer.validateSync();
    assert.strictEqual(err, undefined, 'OrderOffer should validate without errors');
    assert.strictEqual(offer.roundNumber, 1);
    assert.strictEqual(offer.status, 'SENT');
    assert.strictEqual(offer.score, 87.5);
  });

  it('rejects invalid roundNumber (e.g. 0 or 4)', () => {
    const badOffer = new OrderOffer({
      orderId: new mongoose.Types.ObjectId(),
      driverId: new mongoose.Types.ObjectId(),
      roundNumber: 4, // max is 3
      status: 'SENT',
      score: 50,
      scoreBreakdown: {
        etaMinutes: 5,
        etaScore: 50,
        landmarkScore: 50,
        headingScore: 50,
        idleScore: 50,
        acceptanceScore: 50,
      },
      expiresAt: new Date(Date.now() + 15000),
    });

    const err = badOffer.validateSync();
    assert.ok(err?.errors['roundNumber'], 'Should reject roundNumber > 3');
  });

  it('handleRoundTimeout expires open offers and triggers next round', async () => {
    const orderId = new mongoose.Types.ObjectId();
    let updatedOfferStatus = false;
    let nextRoundExecuted = false;

    const originalFindById = Order.findById;
    const originalFindOffers = OrderOffer.find;
    const originalUpdateMany = OrderOffer.updateMany;
    const originalExecuteRound = DispatchService.executeRound;

    try {
      (Order as any).findById = async () => ({
        _id: orderId,
        status: OrderStatus.PENDING,
        dispatchRound: 1,
      });

      (OrderOffer as any).find = async () => [
        { _id: new mongoose.Types.ObjectId(), driverId: new mongoose.Types.ObjectId() },
      ];

      (OrderOffer as any).updateMany = async (_query: any, update: any) => {
        if (update.$set?.status === 'EXPIRED') {
          updatedOfferStatus = true;
        }
        return { modifiedCount: 1 };
      };

      (DispatchService as any).executeRound = async (_id: string, roundNumber: number) => {
        if (roundNumber === 2) {
          nextRoundExecuted = true;
        }
      };

      await DispatchService.handleRoundTimeout(orderId.toString(), 1);

      assert.strictEqual(updatedOfferStatus, true, 'Active offers should be marked EXPIRED');
      assert.strictEqual(nextRoundExecuted, true, 'Should advance to Round 2');
    } finally {
      Order.findById = originalFindById;
      OrderOffer.find = originalFindOffers;
      OrderOffer.updateMany = originalUpdateMany;
      DispatchService.executeRound = originalExecuteRound;
    }
  });

  it('exhaustDispatch marks order EXHAUSTED/CANCELLED and refunds customer escrow balance', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const customerId = new mongoose.Types.ObjectId();
    let orderSavedAsExhausted = false;
    let refundTransferred = false;
    let socketExhaustedEmitted = false;

    const originalSession = mongoose.startSession;
    const originalTransferFunds = WalletService.transferFunds;
    const originalGetSocketService = socketInstance.getSocketService;

    try {
      const mockOrder: any = {
        _id: orderId,
        customerId,
        price: 25.0,
        status: OrderStatus.PENDING,
        dispatchStatus: 'DISPATCHING',
        save: async () => {
          if (mockOrder.dispatchStatus === 'EXHAUSTED' && mockOrder.status === OrderStatus.CANCELLED) {
            orderSavedAsExhausted = true;
          }
        },
      };

      (mongoose as any).startSession = async () => ({
        withTransaction: async (cb: any) => cb(),
        endSession: () => {},
      });

      const originalOrderFindById = Order.findById;
      (Order as any).findById = () => ({
        session: () => mockOrder,
      });

      const originalOfferUpdateMany = OrderOffer.updateMany;
      (OrderOffer as any).updateMany = async () => ({ modifiedCount: 1 });

      (WalletService as any).transferFunds = async (params: any) => {
        if (
          params.from === InternalAccount.SYSTEM_ESCROW &&
          params.to === customerId.toString() &&
          params.amount === 25.0
        ) {
          refundTransferred = true;
        }
      };

      socketInstance.registerSocketService({
        emitDispatchExhausted: (_cid: string, data: any) => {
          if (data.orderId === orderId.toString() && data.refundedAmount === 25.0) {
            socketExhaustedEmitted = true;
          }
        },
      } as any);

      await DispatchService.exhaustDispatch(orderId.toString());

      assert.strictEqual(orderSavedAsExhausted, true, 'Order should be marked EXHAUSTED and CANCELLED');
      assert.strictEqual(refundTransferred, true, 'Escrow funds should be refunded to customer');
      assert.strictEqual(socketExhaustedEmitted, true, 'Customer should receive dispatch exhausted socket event');

      Order.findById = originalOrderFindById;
      OrderOffer.updateMany = originalOfferUpdateMany;
    } finally {
      mongoose.startSession = originalSession;
      WalletService.transferFunds = originalTransferFunds;
    }
  });

  it('concurrent batch acceptance: driver without active unexpired offer is rejected with 409', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const winningDriverId = new mongoose.Types.ObjectId();
    const losingDriverId = new mongoose.Types.ObjectId();

    // Driver 2 does NOT have an active offer (or it expired)
    const originalSession = mongoose.startSession;
    const originalFindOneOffer = OrderOffer.findOne;
    const { Idempotency } = await import('../models/Idempotency');
    const originalIdempotencyFindOne = Idempotency.findOne;

    try {
      (Idempotency as any).findOne = async () => null;

      (mongoose as any).startSession = async () => ({
        withTransaction: async (cb: any) => cb(),
        endSession: () => {},
      });

      // Mock offer check returns null for losing driver
      (OrderOffer as any).findOne = () => ({
        session: () => null,
      });

      const req: any = {
        params: { id: orderId.toString() },
        body: {},
        user: { userId: losingDriverId.toString() },
        idempotencyKey: 'idemp-losing-driver-1',
        id: 'req-1',
      };

      let statusCode = 0;
      let errorResponse: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              errorResponse = data;
              return data;
            },
          };
        },
      };

      await OrderController.accept(req, res);

      assert.strictEqual(statusCode, 409, 'Driver without active offer must receive 409 Conflict');
      assert.strictEqual(errorResponse?.error, 'OFFER_INVALID_OR_EXPIRED');
    } finally {
      mongoose.startSession = originalSession;
      OrderOffer.findOne = originalFindOneOffer;
      Idempotency.findOne = originalIdempotencyFindOne;
    }
  });

  it('rejectOffer endpoint marks offer REJECTED and increments totalOffersRejected', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    let offerMarkedRejected = false;
    let driverProfileIncremented = false;

    const originalFindOneOffer = OrderOffer.findOne;
    const originalUpdateOneProfile = DriverProfile.updateOne;

    try {
      const mockOffer: any = {
        status: 'SENT',
        save: async () => {
          if (mockOffer.status === 'REJECTED') {
            offerMarkedRejected = true;
          }
        },
      };

      (OrderOffer as any).findOne = async () => mockOffer;
      (DriverProfile as any).updateOne = async (_query: any, update: any) => {
        if (update.$inc?.totalOffersRejected === 1) {
          driverProfileIncremented = true;
        }
      };

      const req: any = {
        params: { id: orderId.toString() },
        user: { userId: driverId.toString() },
        body: { reason: 'TOO_FAR' },
      };

      let statusCode = 0;
      let resPayload: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => {
              resPayload = data;
              return data;
            },
          };
        },
      };

      await OrderController.rejectOffer(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(resPayload?.success, true);
      assert.strictEqual(offerMarkedRejected, true);
      assert.strictEqual(driverProfileIncremented, true);
    } finally {
      OrderOffer.findOne = originalFindOneOffer;
      DriverProfile.updateOne = originalUpdateOneProfile;
    }
  });

  it('seenOffer endpoint updates status from SENT to SEEN', async () => {
    const orderId = new mongoose.Types.ObjectId();
    const driverId = new mongoose.Types.ObjectId();
    let offerMarkedSeen = false;

    const originalFindOneOffer = OrderOffer.findOne;

    try {
      const mockOffer: any = {
        status: 'SENT',
        save: async () => {
          if (mockOffer.status === 'SEEN') {
            offerMarkedSeen = true;
          }
        },
      };

      (OrderOffer as any).findOne = async () => mockOffer;

      const req: any = {
        params: { id: orderId.toString() },
        user: { userId: driverId.toString() },
      };

      let statusCode = 0;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (data: any) => data,
          };
        },
      };

      await OrderController.seenOffer(req, res);

      assert.strictEqual(statusCode, 200);
      assert.strictEqual(offerMarkedSeen, true);
    } finally {
      OrderOffer.findOne = originalFindOneOffer;
    }
  });
});
