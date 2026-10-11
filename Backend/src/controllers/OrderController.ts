// controllers/OrderController.ts
import { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import { Order } from '../models/Order';
import { DispatchService } from '../services/DispatchService';
import mongoose from 'mongoose';
import { Queue } from 'bullmq';
import { DeletedOrder } from '../models/DeletedOrder';
import { getSocketService } from '../socketInstance';
import { DriverProfile } from '../models/DriverProfile';
import { redisClient } from '../config/redis';
import { redactOrder } from '../utils/redact';
import { Idempotency } from '../models/Idempotency';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { WalletService } from '../services/WalletService';
import { InternalAccount } from '../config/accounts';
import { ORDER_FSM } from '../config/stateMachine';
import { LandmarkService } from '../services/LandmarkService';
import { OrderOffer } from '../models/OrderOffer';

// Create the queue instance
const manifestQueue = new Queue('manifest-processing', {
  connection: redisClient as any // 👈 Use 'as any' here too
});

export class OrderController {

  /**
   * Handles the creation of a new delivery.
   * Resolves the "Order Failed" error in the Mobile App.
   */
  public static async create(req: Request, res: Response) {
    const {
      pickupLocation,
      pickupLandmark,
      pickupLandmarkId,
      dropoffLocation,
      dropoffLandmark,
      dropoffLandmarkId,
      vehicleType
    } = req.body;

    const customerId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey; // From global middleware
    const requestId = req.id; // From global middleware

    // 1. IDEMPOTENCY CHECK: Prevent duplicate orders on network retry
    const lookupKey = `user:${customerId}:order_create:${idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    // Resolve landmarks if not explicitly provided
    let resolvedPickupLandmarkId = pickupLandmarkId;
    if (!resolvedPickupLandmarkId && pickupLandmark && pickupLocation?.coordinates) {
      try {
        const landmark = await LandmarkService.resolveLandmark(pickupLandmark, pickupLocation.coordinates);
        if (landmark) resolvedPickupLandmarkId = landmark._id;
      } catch (err: any) {
        console.warn('LANDMARK_RESOLVE_PICKUP_WARN:', err.message);
      }
    }

    let resolvedDropoffLandmarkId = dropoffLandmarkId;
    if (!resolvedDropoffLandmarkId && dropoffLandmark && dropoffLocation?.coordinates) {
      try {
        const landmark = await LandmarkService.resolveLandmark(dropoffLandmark, dropoffLocation.coordinates);
        if (landmark) resolvedDropoffLandmarkId = landmark._id;
      } catch (err: any) {
        console.warn('LANDMARK_RESOLVE_DROPOFF_WARN:', err.message);
      }
    }

    const session = await mongoose.startSession();

    try {
      let createdOrder: any;

      await session.withTransaction(async () => {
        // 2. PRICING & LOGIC (Server-Side Authority)
        // distanceKm is computed server-side from coordinates; client input is ignored.
        const { price, commission, distanceKm } = OrderService.calculatePricingForOrder(
          vehicleType,
          pickupLocation.coordinates,
          dropoffLocation.coordinates
        );
        const verificationPin = OrderService.generatePin();

        // 3. FINANCIAL INTEGRITY: Move funds to SYSTEM:ESCROW
        // This ensures the customer has money BEFORE the order is broadcasted.
        await WalletService.transferFunds({
          from: customerId!,
          to: InternalAccount.SYSTEM_ESCROW,
          amount: price,
          referenceId: new mongoose.Types.ObjectId(), // Placeholder, updated below
          idempotencyKey: `ESCROW:${idempotencyKey}`,
          description: `Escrow for new ${vehicleType} delivery`,
          requestId,
          session
        });

        // 4. PERSISTENCE: Create the Order
        const [order] = await Order.create([{
          customerId,
          pickupLocation,
          pickupLandmark,
          pickupLandmarkId: resolvedPickupLandmarkId,
          dropoffLocation,
          dropoffLandmark,
          dropoffLandmarkId: resolvedDropoffLandmarkId,
          vehicleType,
          price,
          commission,
          verificationPin,
          status: 'PENDING'
        }], { session });

        createdOrder = order;

        // 5. IMMUTABLE AUDIT LOG
        await AdminAuditLog.create([{
          adminId: customerId,
          action: 'CREATE_ORDER',
          targetId: order._id,
          targetModel: 'Order',
          details: `Order created: ${vehicleType} from ${pickupLandmark} to ${dropoffLandmark}`,
          requestId
        }], { session });

        // 6. COMMIT IDEMPOTENCY
        const responsePayload = {
          success: true,
          order: redactOrder(order),
          distanceKm,
          traceId: requestId
        };

        await Idempotency.create([{
          key: lookupKey,
          responseBody: responsePayload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }], { session });

        res.status(201).json(responsePayload);
      });

      // 7. EXTERNAL EFFECTS: Triggered only AFTER successful DB commit
      // Kick off multi-round deterministic batch dispatch lifecycle
      if (createdOrder) {
        await DispatchService.startDispatch(createdOrder._id.toString());
      }

    } catch (error: any) {
      console.error(`[OrderCreationError][${requestId}]`, error);

      // Map common errors to actionable codes
      const errorCode = error.message.includes('INSUFFICIENT_FUNDS')
        ? 'INSUFFICIENT_FUNDS'
        : 'TRANSACTION_ABORTED';

      res.status(400).json({
        error: errorCode,
        message: 'Order could not be processed.',
        requestId
      });
    } finally {
      session.endSession();
    }
  }

  /**
  * Retrieves paginated order history for the authenticated customer.
  * Resolves the 500 Error in OrdersListScreen.
  */
  public static async getMyOrders(req: Request, res: Response): Promise<Response> {
    try {
      const customerId = req.user?.userId;

      if (!customerId) {
        return res.status(401).json({ error: 'UNAUTHORIZED: Identity not found' });
      }

      // 1. Safe Pagination Parsing
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
      const skip = (page - 1) * limit;

      // 2. Parallel Database Operations (Faster on low-bandwidth)
      const [orders, total] = await Promise.all([
        Order.find({ customerId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .select('-verificationPin'), // Security: Hide PINs in list view
        Order.countDocuments({ customerId })
      ]);

      // 3. Return structured pagination metadata
      return res.status(200).json({
        success: true,
        orders: orders || [],
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          hasMore: page * limit < total
        }
      });
    } catch (error: any) {
      // ✅ LOG THE ACTUAL ERROR to the backend terminal
      console.error('FETCH_ORDERS_DATABASE_CRASH:', error.message);
      return res.status(500).json({ error: 'FETCH_ORDERS_FAILED' });
    }
  }


  /**
   * Handles driver acceptance of a pending order.
   */
  public static async accept(req: Request, res: Response) {
    const { id } = req.params;
    const { version } = req.body; // 👈 Mandatory from UI to prevent stale acceptance
    const driverId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;
    const requestId = req.id;

    // 1. IDEMPOTENCY GUARD
    const lookupKey = `driver:${driverId}:accept:${id}:${idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();
    try {
      let updatedOrder;
      let siblingDriverIdsToCancel: string[] = [];

      await session.withTransaction(async () => {
        const isLegacy = process.env.DISPATCH_MODE === 'LEGACY_BROADCAST';
        let winningOffer: any = null;

        if (!isLegacy) {
          // 1. OFFER VERIFICATION GATE
          winningOffer = await OrderOffer.findOne({
            orderId: id,
            driverId: new mongoose.Types.ObjectId(driverId),
            status: { $in: ['SENT', 'DELIVERED', 'SEEN'] },
            expiresAt: { $gt: new Date() }
          }).session(session);

          if (!winningOffer) {
            throw new Error('OFFER_INVALID_OR_EXPIRED: You do not have an active offer for this job.');
          }
        }

        // Check if driver currently has an active delivery (max driver capacity invariant)
        const activeOrder = await Order.findOne({
          driverId: new mongoose.Types.ObjectId(driverId),
          status: {
            $in: [
              OrderStatus.ACCEPTED,
              OrderStatus.ARRIVED_AT_PICKUP,
              OrderStatus.PICKED_UP,
              OrderStatus.ARRIVED_AT_DROPOFF,
            ],
          },
        }).session(session);

        const isChainedOrder = Boolean(activeOrder);
        const nextTargetStatus = isChainedOrder ? OrderStatus.CHAINED_RESERVED : OrderStatus.ACCEPTED;

        // 2. ATOMIC FIND & UPDATE WITH LOCK
        const acceptQuery: any = {
          _id: id,
          status: OrderStatus.PENDING,
        };
        if (version !== undefined) acceptQuery.__v = version;

        const updateFields: any = {
          status: nextTargetStatus,
          driverId: new mongoose.Types.ObjectId(driverId),
          dispatchStatus: 'MATCHED',
        };

        if (isChainedOrder) {
          updateFields.isChained = true;
          updateFields.chainedAssignedAt = new Date();
        }

        const order = await Order.findOneAndUpdate(
          acceptQuery,
          { $set: updateFields },
          { session, new: true }
        );

        if (!order) {
          throw new Error('CONCURRENCY_CONFLICT: Order already accepted or modified.');
        }

        updatedOrder = order;

        if (winningOffer) {
          winningOffer.status = 'ACCEPTED';
          winningOffer.respondedAt = new Date();
          await winningOffer.save({ session });

          // Cancel sibling offers in the batch
          const siblingOffers = await OrderOffer.find({
            orderId: id,
            _id: { $ne: winningOffer._id },
            status: { $in: ['SENT', 'DELIVERED', 'SEEN'] }
          }).session(session);

          if (siblingOffers.length > 0) {
            await OrderOffer.updateMany(
              { orderId: id, _id: { $ne: winningOffer._id }, status: { $in: ['SENT', 'DELIVERED', 'SEEN'] } },
              { $set: { status: 'CANCELLED' } },
              { session }
            );
            siblingDriverIdsToCancel = siblingOffers.map(o => o.driverId.toString());
          }

          await DriverProfile.updateOne(
            { userId: new mongoose.Types.ObjectId(driverId) },
            { $inc: { totalOffersAccepted: 1 } },
            { session }
          );
        }

        // 3. AUDIT LOG
        await AdminAuditLog.create([{
          adminId: driverId,
          action: 'ORDER_ACCEPTED',
          targetId: order._id,
          targetModel: 'Order',
          details: `Driver ${driverId} accepted order ${id}`,
          requestId
        }], { session });

        // 4. COMMIT IDEMPOTENCY
        const responsePayload = {
          success: true,
          order: redactOrder(order),
          traceId: requestId
        };

        await Idempotency.create([{
          key: lookupKey,
          responseBody: responsePayload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }], { session });

        res.status(200).json(responsePayload);
      });

      // 5. POST-COMMIT NOTIFICATIONS & UNCHAIN SCHEDULING
      if (updatedOrder) {
        const finalizedOrder = updatedOrder as any;
        if (siblingDriverIdsToCancel.length > 0) {
          try {
            getSocketService().emitOfferCancelled(siblingDriverIdsToCancel, { orderId: id });
          } catch (err: any) {
            console.warn('[OrderController] Socket emit cancel warn:', err.message);
          }
        }

        if (finalizedOrder.status === OrderStatus.CHAINED_RESERVED) {
          // Schedule 5-minute unchaining timeout
          try {
            const { scheduleUnchainTimeout } = await import('../queues/dispatchQueue');
            await scheduleUnchainTimeout(id, driverId!);
          } catch (err: any) {
            console.warn('[OrderController] Failed to schedule unchain timeout:', err.message);
          }

          try {
            getSocketService().io.to(driverId!).emit('chained_order_reserved', {
              orderId: id,
              status: OrderStatus.CHAINED_RESERVED,
            });
            getSocketService().io.to(finalizedOrder.customerId.toString()).emit('order_status_update', {
              orderId: id,
              status: OrderStatus.CHAINED_RESERVED,
              driverId,
            });
          } catch (err: any) {
            console.warn('[OrderController] Socket emit chained reserved warn:', err.message);
          }
        } else {
          getSocketService().io.to(finalizedOrder.customerId.toString()).emit('order_status_update', {
            orderId: id,
            status: OrderStatus.ACCEPTED,
            driverId,
          });
        }
      }
    } catch (error: any) {
      const isConflict =
        error.message.includes('CONCURRENCY') ||
        error.message.includes('OFFER_INVALID_OR_EXPIRED');
      res.status(isConflict ? 409 : 400).json({
        error: isConflict ? 'OFFER_INVALID_OR_EXPIRED' : 'ACCEPT_FAILED',
        message: error.message,
        requestId
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * updateStatus: FSM-Gated Transition & Final Settlement
   * Logic: If newStatus is DELIVERED, triggers Escrow -> Payout transaction.
   */
  public static async updateStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { nextStatus, version } = req.body;
    const userId = req.user?.userId;
    const requestId = req.id;
    const idempotencyKey = req.idempotencyKey;

    const lookupKey = `user:${userId}:update_status:${id}:${nextStatus}:${idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();
    try {
      let updatedOrder;

      await session.withTransaction(async () => {
        // 1. FETCH CURRENT STATE
        const order = await Order.findById(id).session(session);
        if (!order) throw new Error('ORDER_NOT_FOUND');

        // 2. FSM VALIDATION
        const allowed = ORDER_FSM[order.status as OrderStatus];
        if (!allowed || !allowed.includes(nextStatus as OrderStatus)) {
          throw new Error(`ILLEGAL_TRANSITION: Cannot move from ${order.status} to ${nextStatus}`);
        }

        // 3. VERSION CHECK
        // Enforced only when the client supplies a version (the current driver
        // app sends `{ nextStatus }` without one); absent version = no staleness
        // guarantee, which preserves the working driver flow.
        if (version !== undefined && order.__v !== version) throw new Error('CONCURRENCY_CONFLICT: Stale data');

        // 4. SETTLEMENT GUARD: DELIVERED is NOT reachable through status updates.
        // Money movement happens ONLY through POST /orders/:id/verify (PIN-gated).
        if (nextStatus === OrderStatus.DELIVERED) {
          throw new Error('USE_VERIFY_ENDPOINT: Delivery completion requires PIN verification');
        }

        // 5. COMMIT STATE CHANGE
        order.status = nextStatus as OrderStatus;
        await order.save({ session });
        updatedOrder = order;

        const responsePayload = { success: true, order: redactOrder(order), traceId: requestId };
        await Idempotency.create([{
          key: lookupKey,
          responseBody: responsePayload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }], { session });

        res.status(200).json(responsePayload);
      });

      // 6. POST-COMMIT NOTIFICATION
      if (updatedOrder) {
        const recipients = [(updatedOrder as any).customerId.toString(), (updatedOrder as any).driverId.toString()];
        recipients.forEach(r => {
          getSocketService().io.to(r).emit('order_status_update', { orderId: id, status: nextStatus });
        });
      }
    } catch (error: any) {
      res.status(error.message.includes('CONCURRENCY') ? 409 : 400).json({
        error: 'UPDATE_FAILED',
        message: error.message,
        requestId
      });
    } finally {
      session.endSession();
    }
  }

  public static async getDriverDashboard(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const driverId = new mongoose.Types.ObjectId(userId);
      const { DriverLocation } = require('../models/DriverLocation'); // Ensure import

      // Fetch Active Job, History, AND Current Online Status
      const [activeOrder, recentJobs, locationRecord] = await Promise.all([
        Order.findOne({
          driverId,
          status: {
            $in: [
              OrderStatus.ACCEPTED,
              OrderStatus.CHAINED_RESERVED,
              OrderStatus.ARRIVED_AT_PICKUP,
              OrderStatus.PICKED_UP,
              OrderStatus.ARRIVED_AT_DROPOFF,
            ]
          }
        }),
        Order.find({ driverId, status: OrderStatus.DELIVERED }).sort({ updatedAt: -1 }).limit(5),
        DriverLocation.findOne({ userId: driverId })
      ]);

      return res.status(200).json({
        success: true,
        activeOrder: activeOrder || null,
        recentJobs: recentJobs || [],
        // ✅ NEW: Inform the app if the driver is currently online
        isOnline: locationRecord?.isAvailable || false
      });
    } catch (error) {
      return res.status(500).json({ error: 'DASHBOARD_ERROR' });
    }
  }

  /**
   * Fetches a single order by ID.
   * Required to resolve the 404 error in OrderTrackingScreen.
   */
  public static async getOrderById(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

      // 1. QUERY: Allow access if the user is the CUSTOMER OR the assigned DRIVER
      const order = await Order.findOne({
        _id: id,
        $or: [
          { customerId: userId },
          { driverId: userId }
        ]
      })
        .populate('driverId', 'displayName phoneNumber imageUrl')
        .populate('customerId', 'displayName phoneNumber');

      /**
       * ✅ FIX: THE NULL GUARD
       * This informs TypeScript that 'order' exists for the rest of the block.
       */
      if (!order) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      }

      // 2. Fetch Professional Info if a driver is attached
      let driverPlate = '...';
      if (order.driverId) {
        const professionalInfo = await DriverProfile.findOne({
          userId: order.driverId
        }).select('vehicle.plateNumber, imageUrl ');

        driverPlate = professionalInfo?.vehicle?.plateNumber || '...';
      }

      // 3. SUCCESS: Now safe to call .toJSON()
      return res.status(200).json({
        success: true,
        order: {
          ...order.toJSON(),
          driverPlate // Attached for the tracking UI
        }
      });

    } catch (error: any) {
      console.error('FETCH_ORDER_ERROR:', error.message);
      return res.status(500).json({ error: 'SERVER_DATA_FAILURE' });
    }
  }

  /**
   * Owner-only PIN retrieval.
   * The delivery PIN must never reach the driver; it is exposed only to the
   * order's customer so they can relay it to the recipient at dropoff.
   */
  public static async getOrderPin(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const customerId = req.user?.userId;

      if (!customerId) return res.status(401).json({ error: 'UNAUTHORIZED' });

      const order = await Order.findOne({
        _id: id,
        customerId,
      }).select('+verificationPin');

      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      return res.status(200).json({
        success: true,
        verificationPin: order.verificationPin,
      });
    } catch (error: any) {
      return res.status(500).json({ error: 'FETCH_PIN_FAILED' });
    }
  }

  /**
   * Finalizes delivery and triggers wallet settlement.
   * Requires 4-digit PIN provided by the recipient.
   */
  public static async verifyAndComplete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { verificationPin } = req.body;
      const driverId = req.user?.userId as string;
      const idempotencyKey = req.idempotencyKey;

      if (!driverId) return res.status(401).json({ error: 'UNAUTHORIZED' });

      // M3: Idempotency lookup — replay returns the stored response.
      // The settlement itself is already ledger-keyed (PAYOUT/COMMISSION) and
      // paymentSettled-guarded; this prevents a retried request from surfacing
      // an error for an already-settled order.
      const lookupKey = `driver:${driverId}:verify:${id}:${idempotencyKey}`;
      const existingReq = await Idempotency.findOne({ key: lookupKey });
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      // Settlement and PIN verification happen atomically in the service
      await OrderService.verifyAndSettle(id, verificationPin, driverId);

      const responsePayload = {
        success: true,
        message: 'DELIVERY_COMPLETED_AND_PAYMENT_SETTLED'
      };
      // Written after commit (the service owns its own session); a replay of the
      // same key returns the stored success instead of ALREADY_SETTLED.
      await Idempotency.create([{
        key: lookupKey,
        responseBody: responsePayload,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }]);

      return res.status(200).json(responsePayload);
    } catch (error: any) {
      // Root cause: Invalid PIN, Insufficient Funds, or Invalid State
      const status = error.message === 'NOT_ASSIGNED_DRIVER' ? 403 : 400;
      return res.status(status).json({ error: error.message || 'VERIFICATION_FAILED' });
    }
  }

  /**
 * Retrieves orders assigned to the authenticated driver.
 * Supports filtering by status (active vs completed).
 */
  public static async getDriverOrders(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { status } = req.query; // 'active' or 'completed'

      if (!userId) return res.status(401).json({ error: 'UNAUTHORIZED' });

      // ✅ FIX: Explicitly cast String ID to MongoDB ObjectId
      const driverId = new mongoose.Types.ObjectId(userId);

      let query: any = { driverId };

      if (status === 'active') {
        query.status = { $in: ['ACCEPTED', 'PICKED_UP', 'ARRIVED'] };
      } else if (status === 'completed') {
        query.status = 'DELIVERED';
      }

      console.log(`FETCH_LOG: Searching ${status} jobs for Driver ${userId}`);

      const orders = await Order.find(query)
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('customerId', 'displayName phoneNumber'); // Include customer info for the history card

      console.log(`FETCH_LOG: Found ${orders.length} matches.`);

      return res.status(200).json({
        success: true,
        orders: orders || []
      });
    } catch (error: any) {
      console.error('FETCH_DRIVER_ORDERS_ERROR:', error.message);
      return res.status(500).json({ error: 'HISTORY_QUERY_FAILED' });
    }
  }


  public static async deleteOrder(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const userId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `user:${userId}:delete_order:${id}:${idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    // 1. Initialize MongoDB Session for Atomic Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 2. Find and Validate the order
      const order = await Order.findOne({ _id: id, customerId: userId }).session(session);

      if (!order) {
        await session.abortTransaction();
        return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      }

      if (order.status !== 'PENDING') {
        await session.abortTransaction();
        return res.status(403).json({ error: 'CANNOT_DELETE_ACTIVE_ORDER' });
      }

      // 3. REFUND ESCROW: Move any escrowed funds back to the customer atomically.
      await WalletService.releaseEscrow({
        order,
        reason: 'Customer deleted pending order',
        requestId: req.id,
        session
      });

      // 4. ARCHIVE: Create the Audit Record
      await DeletedOrder.create([{
        originalOrderId: order._id,
        customerId: order.customerId,
        orderData: order.toObject(),
        audit: {
          deletedAt: new Date(),
          deletedBy: new mongoose.Types.ObjectId(userId),
          reason: 'Customer deleted pending request'
        }
      }], { session });

      // 5. PURGE: Remove from active collection
      await Order.findByIdAndDelete(id).session(session);

      // 6. COMMIT: Finalize both operations
      await session.commitTransaction();
      console.log(`AUDIT_LOG: Order ${id} archived and removed by User ${userId}`);

      // 7. M3: Record the idempotency result in the same session as the deletion.
      const responsePayload = {
        success: true,
        message: 'ORDER_ARCHIVED_SUCCESSFULLY'
      };
      await Idempotency.create([{
        key: lookupKey,
        responseBody: responsePayload,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }], { session });

      return res.status(200).json(responsePayload);

    } catch (error: any) {
      await session.abortTransaction();
      console.error('ARCHIVE_FAILURE:', error.message);
      return res.status(500).json({ error: 'DELETE_OPERATION_FAILED' });
    } finally {
      session.endSession();
    }
  }

  /**
   * Driver declines a targeted offer.
   */
  public static async rejectOffer(req: Request, res: Response): Promise<Response> {
    const { id } = req.params; // orderId
    const driverId = req.user?.userId;
    const { reason } = req.body;

    try {
      const offer = await OrderOffer.findOne({
        orderId: id,
        driverId: new mongoose.Types.ObjectId(driverId),
        status: { $in: ['SENT', 'DELIVERED', 'SEEN'] },
      });

      if (!offer) {
        return res.status(404).json({ error: 'OFFER_NOT_FOUND', message: 'No active offer found to reject.' });
      }

      offer.status = 'REJECTED';
      offer.respondedAt = new Date();
      offer.rejectionReason = reason || 'DECLINED_BY_DRIVER';
      await offer.save();

      await DriverProfile.updateOne(
        { userId: new mongoose.Types.ObjectId(driverId) },
        { $inc: { totalOffersRejected: 1 } }
      );

      return res.status(200).json({ success: true, message: 'OFFER_REJECTED' });
    } catch (error: any) {
      console.error('REJECT_OFFER_ERROR:', error);
      return res.status(500).json({ error: 'REJECT_FAILED', message: error.message });
    }
  }

  /**
   * Driver app reports that the offer was rendered/seen on screen.
   */
  public static async seenOffer(req: Request, res: Response): Promise<Response> {
    const { id } = req.params; // orderId
    const driverId = req.user?.userId;

    try {
      const offer = await OrderOffer.findOne({
        orderId: id,
        driverId: new mongoose.Types.ObjectId(driverId),
        status: { $in: ['SENT', 'DELIVERED'] },
      });

      if (offer) {
        offer.status = 'SEEN';
        await offer.save();
      }

      return res.status(200).json({ success: true });
    } catch (error: any) {
      console.error('SEEN_OFFER_ERROR:', error);
      return res.status(500).json({ error: 'SEEN_FAILED', message: error.message });
    }
  }

  /**
   * Phase 4: Submit 1-tap post-delivery verification feedback for the dropoff landmark.
   * Body: { isAccurate: boolean }
   * Updates landmark confidence score (+5 or -10).
   */
  public static async submitLandmarkFeedback(req: Request, res: Response): Promise<Response> {
    const { id } = req.params; // orderId
    const driverId = req.user?.userId;
    const { isAccurate } = req.body;

    if (typeof isAccurate !== 'boolean') {
      return res.status(400).json({ error: 'INVALID_FEEDBACK', message: 'isAccurate must be a boolean' });
    }

    try {
      const order = await Order.findById(id);
      if (!order) {
        return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
      }

      // Must be the assigned driver
      if (!order.driverId || order.driverId.toString() !== driverId) {
        return res.status(403).json({ error: 'NOT_ASSIGNED_DRIVER' });
      }

      const landmarkId = order.dropoffLandmarkId || order.pickupLandmarkId;
      if (!landmarkId) {
        return res.status(400).json({
          error: 'NO_ASSOCIATED_LANDMARK',
          message: 'This order does not have an associated landmark to review',
        });
      }

      const updatedLandmark = await LandmarkService.recordFeedback(landmarkId, isAccurate);

      return res.status(200).json({
        success: true,
        landmarkId,
        confidenceScore: updatedLandmark?.confidenceScore ?? 50,
      });
    } catch (error: any) {
      console.error('LANDMARK_FEEDBACK_ERROR:', error);
      return res.status(500).json({ error: 'FEEDBACK_FAILED', message: error.message });
    }
  }
}