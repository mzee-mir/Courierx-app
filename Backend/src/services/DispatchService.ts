// services/DispatchService.ts
import mongoose, { Types } from 'mongoose';
import { DriverLocation } from '../models/DriverLocation';
import { VehicleType, OrderStatus } from '../enums/OrderEnums';
import { DriverProfile } from '../models/DriverProfile';
import { DriverLandmarkStat } from '../models/DriverLandmarkStat';
import { Order, IOrder } from '../models/Order';
import { OrderOffer } from '../models/OrderOffer';
import { MatchingEngine, CandidateDriverInput } from './MatchingEngine';
import { WalletService } from './WalletService';
import { InternalAccount } from '../config/accounts';
import { getSocketService } from '../socketInstance';
import { scheduleRoundTimeout } from '../queues/dispatchQueue';
import { GeoTrackingService } from './GeoTrackingService';

export interface MatchingCriteria {
  pickupCoordinates: [number, number];
  pickupLandmarkId?: Types.ObjectId | string;
  dropoffCoordinates?: [number, number];
  dropoffLandmarkId?: Types.ObjectId | string;
  vehicleType: string;
  radiusInMeters?: number;
}

export interface CandidateDriverProfile {
  driverId: string;
  coordinates: [number, number];
  heading?: number;
  speed?: number;
  connectivityState: string;
  landmarkDeliveries?: number;
  distanceMeters?: number;
}

export class DispatchService {
  public static readonly ROUND_CONFIG = {
    1: { radiusMeters: 3000, batchSize: 1 },  // Round 1: Top 1 candidate <= 3km
    2: { radiusMeters: 7000, batchSize: 2 },  // Round 2: Top 2 candidates <= 7km
    3: { radiusMeters: 15000, batchSize: 3 }, // Round 3: Top 3 candidates <= 15km
  } as const;


  /**
   * Starts the multi-round dispatch lifecycle for a newly placed order.
   */
  public static async startDispatch(orderId: string): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) {
      console.warn(`[DispatchService] Order ${orderId} not found for dispatch.`);
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      console.log(`[DispatchService] Order ${orderId} is in status ${order.status}; skipping dispatch.`);
      return;
    }

    const dispatchMode = process.env.DISPATCH_MODE || 'BATCH_RANKED';

    if (dispatchMode === 'LEGACY_BROADCAST') {
      console.log(`[DispatchService] LEGACY_BROADCAST mode enabled for Order ${orderId}`);
      const nearbyDrivers = await this.findNearbyDrivers(
        order.pickupLocation.coordinates,
        order.vehicleType
      );
      try {
        const { redactOrder } = await import('../utils/redact');
        getSocketService().broadcastNewOrder(nearbyDrivers, redactOrder(order));
      } catch (err: any) {
        console.warn('[DispatchService] Broadcast fallback socket warning:', err.message);
      }
      return;
    }

    // Set order dispatch metadata
    order.dispatchStatus = 'DISPATCHING';
    order.dispatchRound = 1;
    await order.save();

    console.log(`[DispatchService] Initiating Round 1 dispatch for Order ${orderId}`);
    await this.executeRound(orderId, 1);
  }

  /**
   * Executes a specific round (1, 2, or 3) for an order:
   * 1. Excludes drivers who previously rejected or were offered.
   * 2. Finds candidates within round radius and ranks them with MatchingEngine.
   * 3. Creates OrderOffer records and emits targeted 15s socket events.
   * 4. Enqueues a 15-second timeout in BullMQ.
   */
  public static async executeRound(orderId: string, roundNumber: number): Promise<void> {
    if (roundNumber > 3) {
      await this.exhaustDispatch(orderId);
      return;
    }

    const order = await Order.findById(orderId);
    if (!order || order.status !== OrderStatus.PENDING) {
      console.log(`[DispatchService] Order ${orderId} no longer pending for round ${roundNumber}.`);
      return;
    }

    order.dispatchRound = roundNumber;
    await order.save();

    // Notify customer of round progression
    try {
      getSocketService().emitDispatchRoundUpdate(order.customerId.toString(), {
        orderId,
        roundNumber,
      });
    } catch (err: any) {
      console.warn('[DispatchService] Socket emit round update warn:', err.message);
    }

    const config = this.ROUND_CONFIG[roundNumber as keyof typeof this.ROUND_CONFIG] || this.ROUND_CONFIG[3];

    // Query drivers already offered or rejected to prevent spamming the same driver
    const existingOffers = await OrderOffer.find({ orderId: order._id }).select('driverId status');
    const excludedDriverIds = existingOffers.map(o => o.driverId.toString());

    // Phase 4 Invariant: Exclude drivers who already hold a CHAINED_RESERVED job
    const chainedReservedOrders = await Order.find({
      status: OrderStatus.CHAINED_RESERVED,
      driverId: { $exists: true, $ne: null },
    }).select('driverId');
    for (const co of chainedReservedOrders) {
      if (co.driverId) {
        excludedDriverIds.push(co.driverId.toString());
      }
    }

    // 1. Phase 3: Find idle candidate drivers via Redis Geo (fast path) with MongoDB fallback
    let nearbyLocations: Array<{
      userId: any;
      location: { coordinates: [number, number] };
      heading?: number;
      speed?: number;
      connectivityState: string;
      isChained?: boolean;
      activeOrderRemainingMinutes?: number;
    }> = [];

    try {
      const geoCandidates = await GeoTrackingService.findNearbyDrivers({
        coordinates: order.pickupLocation.coordinates,
        vehicleType: order.vehicleType,
        radiusKm: config.radiusMeters / 1000,
        excludeDriverIds: excludedDriverIds,
      });

      nearbyLocations = geoCandidates.map(c => ({
        userId: new mongoose.Types.ObjectId(c.driverId),
        location: { coordinates: c.coordinates },
        heading: c.heading,
        speed: c.speed,
        connectivityState: c.connectivityState,
      }));
    } catch (err: any) {
      console.warn('[DispatchService] GeoTracking fallback to MongoDB:', err.message);
      nearbyLocations = await DriverLocation.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: order.pickupLocation.coordinates },
            $maxDistance: config.radiusMeters,
          },
        },
        isAvailable: true,
        connectivityState: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
        userId: { $nin: excludedDriverIds.map(id => new mongoose.Types.ObjectId(id)) },
      }).select('userId location heading speed connectivityState');
    }

    // 1b. Phase 4: Query Finishing-Soon Candidates (Virtual Origins)
    // Find active orders nearing completion whose drivers are not already excluded/chained
    try {
      const finishingSoonOrders = await Order.find({
        status: { $in: [OrderStatus.ARRIVED_AT_DROPOFF, OrderStatus.PICKED_UP] },
        driverId: {
          $exists: true,
          $ne: null,
          $nin: excludedDriverIds.map(id => new mongoose.Types.ObjectId(id)),
        },
      }).select('driverId dropoffLocation status updatedAt');

      if (finishingSoonOrders.length > 0) {
        const finishingDriverIds = finishingSoonOrders.map(o => o.driverId!);
        // Verify driver connectivity is ACTIVE or GRACE_PERIOD
        const finishingLocations = await DriverLocation.find({
          userId: { $in: finishingDriverIds },
          connectivityState: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
        }).select('userId heading speed connectivityState');

        const driverLocStateMap = new Map<string, any>();
        for (const fl of finishingLocations) {
          driverLocStateMap.set(fl.userId.toString(), fl);
        }

        for (const fo of finishingSoonOrders) {
          const dIdStr = fo.driverId!.toString();
          const dLoc = driverLocStateMap.get(dIdStr);
          if (!dLoc) continue; // Not active/connected

          // Virtual Origin is drop-off coordinates of their current active delivery
          const virtualCoords = fo.dropoffLocation.coordinates;
          const distKm = MatchingEngine.haversineDistanceKm(
            virtualCoords,
            order.pickupLocation.coordinates
          );

          // Check if virtual origin is within round radius
          if (distKm * 1000 <= config.radiusMeters) {
            const remainingMinutes = fo.status === OrderStatus.ARRIVED_AT_DROPOFF ? 1.5 : 3.0;
            nearbyLocations.push({
              userId: fo.driverId,
              location: { coordinates: virtualCoords },
              heading: dLoc.heading,
              speed: dLoc.speed,
              connectivityState: dLoc.connectivityState,
              isChained: true,
              activeOrderRemainingMinutes: remainingMinutes,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[DispatchService] Finishing-soon query warning:', err.message);
    }

    if (nearbyLocations.length === 0) {
      console.log(`[DispatchService] Zero candidates found in Round ${roundNumber} (${config.radiusMeters}m).`);
      if (roundNumber < 3) {
        // Expand radius immediately
        await this.executeRound(orderId, roundNumber + 1);
      } else {
        await this.exhaustDispatch(orderId);
      }
      return;
    }

    const potentialDriverIds = nearbyLocations.map(loc => loc.userId);

    // 2. Filter by vehicle type & approved status
    const matchingVehicleTypes =
      order.vehicleType.toLowerCase() === VehicleType.CAR.toLowerCase()
        ? { $in: ['car', 'van'] }
        : order.vehicleType.toLowerCase();

    const matchingDrivers = await DriverProfile.find({
      userId: { $in: potentialDriverIds },
      'vehicle.vehicleType': matchingVehicleTypes,
      status: 'approved',
    });

    if (matchingDrivers.length === 0) {
      console.log(`[DispatchService] No approved vehicles matching ${order.vehicleType} in Round ${roundNumber}.`);
      if (roundNumber < 3) {
        await this.executeRound(orderId, roundNumber + 1);
      } else {
        await this.exhaustDispatch(orderId);
      }
      return;
    }

    // 3. Query landmark familiarity stats if pickup landmark is known
    const landmarkFamiliarityMap = new Map<string, number>();
    if (order.pickupLandmarkId) {
      try {
        const stats = await DriverLandmarkStat.find({
          driverId: { $in: matchingDrivers.map(d => d.userId) },
          systemLandmarkId: order.pickupLandmarkId,
        });
        for (const s of stats) {
          landmarkFamiliarityMap.set(s.driverId.toString(), s.completedDeliveries);
        }
      } catch (err: any) {
        console.warn('[DispatchService] Landmark stats lookup warning:', err.message);
      }
    }

    // Map locations for quick lookup
    const locMap = new Map<string, any>();
    for (const loc of nearbyLocations) {
      locMap.set(loc.userId.toString(), loc);
    }

    // 4. Build inputs for MatchingEngine
    const candidateInputs: CandidateDriverInput[] = matchingDrivers.map(profile => {
      const loc = locMap.get(profile.userId.toString());
      return {
        driverId: profile.userId.toString(),
        coordinates: loc.location.coordinates,
        heading: loc.heading,
        speed: loc.speed,
        vehicleType: profile.vehicle.vehicleType,
        completedLandmarkDeliveries: landmarkFamiliarityMap.get(profile.userId.toString()) || 0,
        lastDutyToggleAt: profile.lastDutyToggleAt,
        totalOffersReceived: profile.totalOffersReceived || 0,
        totalOffersAccepted: profile.totalOffersAccepted || 0,
        isChained: loc.isChained || false,
        activeOrderRemainingMinutes: loc.activeOrderRemainingMinutes,
      };
    });

    // 5. Rank deterministically and slice batch
    const ranked = MatchingEngine.rankCandidates(candidateInputs, order.pickupLocation.coordinates);
    const selectedBatch = ranked.slice(0, config.batchSize);

    if (selectedBatch.length === 0) {
      if (roundNumber < 3) {
        await this.executeRound(orderId, roundNumber + 1);
      } else {
        await this.exhaustDispatch(orderId);
      }
      return;
    }

    console.log(
      `[DispatchService] Selected top ${selectedBatch.length} driver(s) for Order ${orderId} (Round ${roundNumber})`
    );

    const now = Date.now();
    const expiresAt = new Date(now + 15000); // 15s window

    // 6. Create OrderOffer documents and emit socket events
    for (const candidate of selectedBatch) {
      try {
        const candidateLoc = locMap.get(candidate.driverId);
        const isChainedCandidate = Boolean(candidateLoc?.isChained);

        const offer = await OrderOffer.create({
          orderId: order._id,
          driverId: new mongoose.Types.ObjectId(candidate.driverId),
          roundNumber,
          status: 'SENT',
          score: candidate.score,
          scoreBreakdown: candidate.scoreBreakdown,
          expiresAt,
        });

        // Increment total offers received on profile
        await DriverProfile.updateOne(
          { userId: new mongoose.Types.ObjectId(candidate.driverId) },
          { $inc: { totalOffersReceived: 1 } }
        );

        // Targeted socket event
        const offerPayload: any = {
          orderId: order._id.toString(),
          offerId: offer._id.toString(),
          roundNumber,
          pickupLandmark: order.pickupLandmark,
          dropoffLandmark: order.dropoffLandmark,
          pickupCoordinates: order.pickupLocation.coordinates,
          dropoffCoordinates: order.dropoffLocation.coordinates,
          vehicleType: order.vehicleType,
          distanceKm: candidate.distanceKm,
          etaMinutes: candidate.etaMinutes,
          price: order.price,
          commission: order.commission,
          netPayout: Math.round((order.price - order.commission) * 100) / 100,
          expiresAt,
          countdownSeconds: 15,
          isChained: isChainedCandidate,
          ...(isChainedCandidate ? { badgeText: 'Next Job (Queued)' } : {}),
        };

        getSocketService().emitNewOrderOffer(candidate.driverId, offerPayload);
      } catch (err: any) {
        console.error(`[DispatchService] Failed to create offer for driver ${candidate.driverId}:`, err.message);
      }
    }

    // 7. Schedule BullMQ 15-second delayed job for timeout
    try {
      await scheduleRoundTimeout(orderId, roundNumber, 15000);
    } catch (err: any) {
      console.warn(`[DispatchService] BullMQ schedule failed; fallback timer:`, err.message);
      // In-memory fallback if Redis is unavailable in local testing
      setTimeout(() => {
        this.handleRoundTimeout(orderId, roundNumber).catch(() => {});
      }, 15000);
    }
  }

  /**
   * Handles 15-second round expiration when no driver in the batch accepted.
   */
  public static async handleRoundTimeout(orderId: string, roundNumber: number): Promise<void> {
    const order = await Order.findById(orderId);
    if (!order) return;

    // If order was already accepted or cancelled, nothing more to do
    if (order.status !== OrderStatus.PENDING) {
      console.log(`[DispatchService] Order ${orderId} already in ${order.status}; timeout ignored.`);
      return;
    }

    // Expire active offers from this round
    const expiredOffers = await OrderOffer.find({
      orderId: order._id,
      roundNumber,
      status: { $in: ['SENT', 'DELIVERED', 'SEEN'] },
    });

    if (expiredOffers.length > 0) {
      await OrderOffer.updateMany(
        {
          orderId: order._id,
          roundNumber,
          status: { $in: ['SENT', 'DELIVERED', 'SEEN'] },
        },
        { $set: { status: 'EXPIRED' } }
      );

      // Dismiss modals on driver devices
      try {
        const driverIds = expiredOffers.map(o => o.driverId.toString());
        getSocketService().emitOfferCancelled(driverIds, { orderId });
      } catch (err: any) {
        console.warn('[DispatchService] Socket emit cancel warn:', err.message);
      }
    }

    // Progress to next round or exhaust
    if (roundNumber < 3) {
      console.log(`[DispatchService] Round ${roundNumber} timed out for Order ${orderId}. Advancing to Round ${roundNumber + 1}`);
      await this.executeRound(orderId, roundNumber + 1);
    } else {
      console.log(`[DispatchService] Round 3 timed out for Order ${orderId}. Exhausting dispatch.`);
      await this.exhaustDispatch(orderId);
    }
  }

  /**
   * Terminal state: No driver accepted after 3 rounds or no candidates exist.
   * Atomically marks order EXHAUSTED / CANCELLED and refunds customer escrow balance.
   */
  public static async exhaustDispatch(orderId: string): Promise<void> {
    const session = await mongoose.startSession();

    try {
      let refundedOrder: IOrder | null = null;

      await session.withTransaction(async () => {
        const order = await Order.findById(orderId).session(session);
        if (!order || order.status !== OrderStatus.PENDING) {
          return;
        }

        // Cancel order and record dispatch exhaustion
        order.dispatchStatus = 'EXHAUSTED';
        order.status = OrderStatus.CANCELLED;
        order.dispatchExhaustedAt = new Date();
        await order.save({ session });

        // Cancel any lingering open offers
        await OrderOffer.updateMany(
          { orderId: order._id, status: { $in: ['SENT', 'DELIVERED', 'SEEN'] } },
          { $set: { status: 'CANCELLED' } },
          { session }
        );

        // Refund escrow directly to customer wallet using existing double-entry ledger
        await WalletService.transferFunds({
          from: InternalAccount.SYSTEM_ESCROW,
          to: order.customerId.toString(),
          amount: order.price,
          referenceId: order._id,
          idempotencyKey: `REFUND:EXHAUSTED:${order._id}`,
          description: `Full refund for unfulfilled delivery #${order._id}`,
          requestId: `refund-exhausted-${order._id}`,
          session,
        });

        refundedOrder = order;
      });

      // Post-commit external notification
      if (refundedOrder) {
        const order = refundedOrder as IOrder;
        console.log(`[DispatchService] Order ${orderId} cancelled & refunded \$${order.price} to customer ${order.customerId}`);
        try {
          getSocketService().emitDispatchExhausted(order.customerId.toString(), {
            orderId: order._id.toString(),
            refundedAmount: order.price,
          });
        } catch (err: any) {
          console.warn('[DispatchService] Socket emit exhausted warn:', err.message);
        }
      }
    } catch (err: any) {
      console.error(`[DispatchService] Critical error exhausting Order ${orderId}:`, err);
    } finally {
      session.endSession();
    }
  }

  /**
   * Primary candidate matching helper for exploratory queries.
   * Phase 3: Uses Redis Geo with automatic MongoDB fallback.
   */
  public static async findCandidates(criteria: MatchingCriteria): Promise<string[]> {
    const {
      pickupCoordinates,
      pickupLandmarkId,
      vehicleType,
      radiusInMeters = 50000,
    } = criteria;

    // Exclude drivers who already hold a CHAINED_RESERVED order
    const chainedReservedOrders = await Order.find({
      status: OrderStatus.CHAINED_RESERVED,
      driverId: { $exists: true, $ne: null },
    }).select('driverId');
    const excludedDriverIds = chainedReservedOrders
      .map(o => o.driverId?.toString())
      .filter((id): id is string => Boolean(id));

    try {
      // Phase 3: Redis Geo fast path
      const geoCandidates = await GeoTrackingService.findNearbyDrivers({
        coordinates: pickupCoordinates,
        vehicleType,
        radiusKm: radiusInMeters / 1000,
        excludeDriverIds: excludedDriverIds,
      });

      const candidateIds = geoCandidates.map(c => new mongoose.Types.ObjectId(c.driverId));

      // Phase 4: Include finishing-soon candidates whose virtual origin (drop-off) is within radius
      const finishingSoonOrders = await Order.find({
        status: { $in: [OrderStatus.ARRIVED_AT_DROPOFF, OrderStatus.PICKED_UP] },
        driverId: {
          $exists: true,
          $ne: null,
          $nin: excludedDriverIds.map(id => new mongoose.Types.ObjectId(id)),
        },
      }).select('driverId dropoffLocation status');

      for (const fo of finishingSoonOrders) {
        if (!fo.driverId) continue;
        const distKm = MatchingEngine.haversineDistanceKm(
          fo.dropoffLocation.coordinates,
          pickupCoordinates
        );
        if (distKm * 1000 <= radiusInMeters) {
          if (!candidateIds.some(cid => cid.equals(fo.driverId!))) {
            candidateIds.push(fo.driverId);
          }
        }
      }

      if (candidateIds.length === 0) return [];

      const matchingVehicleTypes =
        vehicleType.toLowerCase() === VehicleType.CAR.toLowerCase()
          ? { $in: ['car', 'van'] }
          : vehicleType.toLowerCase();

      const matchingDrivers = await DriverProfile.find({
        userId: { $in: candidateIds },
        'vehicle.vehicleType': matchingVehicleTypes,
        status: 'approved',
      }).select('userId');

      return matchingDrivers.map(d => d.userId.toString());
    } catch (err: any) {
      console.warn('[DispatchService] findCandidates fallback to MongoDB:', err.message);

      // MongoDB fallback (Phase 2 path)
      const nearbyLocations = await DriverLocation.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: pickupCoordinates },
            $maxDistance: radiusInMeters,
          },
        },
        isAvailable: true,
        connectivityState: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
        userId: { $nin: excludedDriverIds.map(id => new mongoose.Types.ObjectId(id)) },
      }).select('userId location heading speed connectivityState');

      const potentialDriverIds = nearbyLocations.map(loc => loc.userId);

      // Include finishing-soon candidates in MongoDB fallback path
      const finishingSoonOrders = await Order.find({
        status: { $in: [OrderStatus.ARRIVED_AT_DROPOFF, OrderStatus.PICKED_UP] },
        driverId: {
          $exists: true,
          $ne: null,
          $nin: excludedDriverIds.map(id => new mongoose.Types.ObjectId(id)),
        },
      }).select('driverId dropoffLocation status');

      for (const fo of finishingSoonOrders) {
        if (!fo.driverId) continue;
        const distKm = MatchingEngine.haversineDistanceKm(
          fo.dropoffLocation.coordinates,
          pickupCoordinates
        );
        if (distKm * 1000 <= radiusInMeters) {
          if (!potentialDriverIds.some(pid => pid.equals(fo.driverId!))) {
            potentialDriverIds.push(fo.driverId);
          }
        }
      }

      if (potentialDriverIds.length === 0) return [];

      const matchingVehicleTypes =
        vehicleType.toLowerCase() === VehicleType.CAR.toLowerCase()
          ? { $in: ['car', 'van'] }
          : vehicleType.toLowerCase();

      const matchingDrivers = await DriverProfile.find({
        userId: { $in: potentialDriverIds },
        'vehicle.vehicleType': matchingVehicleTypes,
        status: 'approved',
      }).select('userId');

      return matchingDrivers.map(d => d.userId.toString());
    }
  }

  /**
   * Backward-compatible wrapper around findCandidates.
   */
  public static async findNearbyDrivers(
    coordinates: [number, number],
    requiredVehicle: string,
    radiusInMeters: number = 50000
  ): Promise<string[]> {
    return this.findCandidates({
      pickupCoordinates: coordinates,
      vehicleType: requiredVehicle,
      radiusInMeters,
    });
  }

  /**
   * Simulated Broadcast Logic for fallback
   */
  public static async broadcastOrder(orderId: string, driverIds: string[]): Promise<void> {
    if (driverIds.length === 0) {
      console.log(`DISPATCH_NOTICE: No drivers found for Order ${orderId}`);
      return;
    }

    console.log(`DISPATCH_BROADCAST: Notifying ${driverIds.length} drivers for Order ${orderId}`);
  }
}