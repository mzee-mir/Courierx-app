// controllers/OrderController.ts
import { Request, Response } from 'express';
import { OrderService } from '../services/OrderService';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import { Order } from '../models/Order';
import { DispatchService } from '../services/DispatchService';
import mongoose from 'mongoose';
import { Queue } from 'bullmq';
import { DeletedOrder } from '../models/DeletedOrder';
import { SocketService } from '../socket';
import { socketService } from '..';
import { DriverProfile } from '../models/DriverProfile';
import { redisClient } from '../config/redis';
import { redactOrder } from '../utils/redact';
import { Idempotency } from '../models/Idempotency';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { WalletService } from '../services/WalletService';
import { InternalAccount } from '../config/accounts';
import { ORDER_FSM } from '../config/stateMachine';

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
      dropoffLocation,
      dropoffLandmark,
      vehicleType,
      distanceKm
    } = req.body;

    const customerId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey; // From global middleware
    const requestId = req.id; // From global middleware

    // 1. IDEMPOTENCY CHECK: Prevent duplicate orders on network retry
    const lookupKey = `user:${customerId}:order_create:${idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();

    try {
      let createdOrder;

      await session.withTransaction(async () => {
        // 2. PRICING & LOGIC (Server-Side Authority)
        const { price, commission } = OrderService.calculatePricing(vehicleType, distanceKm);
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
          dropoffLocation,
          dropoffLandmark,
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
      // Look for nearby drivers and broadcast via Socket.io
      if (createdOrder) {
        const nearbyDrivers = await DispatchService.findNearbyDrivers(
          (createdOrder as any).pickupLocation.coordinates,
          (createdOrder as any).vehicleType
        );

        socketService.broadcastNewOrder(nearbyDrivers, redactOrder(createdOrder));
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

      await session.withTransaction(async () => {
        // 2. ATOMIC FIND & UPDATE WITH LOCK
        // Query condition ensures order is still PENDING and version matches UI
        const order = await Order.findOneAndUpdate(
          {
            _id: id,
            status: OrderStatus.PENDING,
            __v: version
          },
          {
            $set: {
              status: OrderStatus.ACCEPTED,
              driverId: new mongoose.Types.ObjectId(driverId)
            }
          },
          { session, new: true }
        );

        if (!order) {
          throw new Error('CONCURRENCY_CONFLICT: Order already accepted or modified.');
        }

        updatedOrder = order;

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

      // 5. POST-COMMIT NOTIFICATION
      if (updatedOrder) {
        socketService.io.to((updatedOrder as any).customerId.toString()).emit('order_status_update', {
          orderId: id,
          status: OrderStatus.ACCEPTED,
          driverId
        });
      }
    } catch (error: any) {
      res.status(error.message.includes('CONCURRENCY') ? 409 : 400).json({
        error: 'ACCEPT_FAILED',
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
        if (order.__v !== version) throw new Error('CONCURRENCY_CONFLICT: Stale data');

        // 4. SPECIAL LOGIC: FINAL SETTLEMENT
        if (nextStatus === OrderStatus.DELIVERED) {
          // Move funds from ESCROW to DRIVER and SYSTEM
          // This uses the WalletService we hardened in Module A
          await WalletService.transferFunds({
            from: InternalAccount.SYSTEM_ESCROW,
            to: order.driverId!.toString(),
            amount: order.price - order.commission,
            referenceId: order._id,
            idempotencyKey: `PAYOUT:${order._id}`,
            description: `Driver earnings for Order ${order._id}`,
            requestId,
            session
          });

          await WalletService.transferFunds({
            from: InternalAccount.SYSTEM_ESCROW,
            to: InternalAccount.SYSTEM_REVENUE,
            amount: order.commission,
            referenceId: order._id,
            idempotencyKey: `COMMISSION:${order._id}`,
            description: `System commission for Order ${order._id}`,
            requestId,
            session
          });

          order.paymentSettled = true;
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
          socketService.io.to(r).emit('order_status_update', { orderId: id, status: nextStatus });
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
        Order.findOne({ driverId, status: { $in: ['ACCEPTED', 'PICKED_UP', 'ARRIVED'] } }),
        Order.find({ driverId, status: 'DELIVERED' }).sort({ updatedAt: -1 }).limit(5),
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
      }).populate('driverId', 'displayName phoneNumber imageUrl');

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
   * Finalizes delivery and triggers wallet settlement.
   * Requires 4-digit PIN provided by the recipient.
   */
  public static async verifyAndComplete(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { verificationPin } = req.body;

      // Settlement and PIN verification happen atomically in the service
      await OrderService.verifyAndSettle(id, verificationPin);

      return res.status(200).json({
        success: true,
        message: 'DELIVERY_COMPLETED_AND_PAYMENT_SETTLED'
      });
    } catch (error: any) {
      // Root cause: Invalid PIN, Insufficient Funds, or Invalid State
      return res.status(400).json({ error: error.message || 'VERIFICATION_FAILED' });
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

      // 3. ARCHIVE: Create the Audit Record
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

      // 4. PURGE: Remove from active collection
      await Order.findByIdAndDelete(id).session(session);

      // 5. COMMIT: Finalize both operations
      await session.commitTransaction();
      console.log(`AUDIT_LOG: Order ${id} archived and removed by User ${userId}`);

      return res.status(200).json({
        success: true,
        message: 'ORDER_ARCHIVED_SUCCESSFULLY'
      });

    } catch (error: any) {
      await session.abortTransaction();
      console.error('ARCHIVE_FAILURE:', error.message);
      return res.status(500).json({ error: 'DELETE_OPERATION_FAILED' });
    } finally {
      session.endSession();
    }
  }
}