import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { OrderStatus } from '../enums/OrderEnums';
import mongoose from 'mongoose';
import { getSocketService } from '../socketInstance'; // To notify drivers instantly
import { WalletService } from '../services/WalletService';
import { ORDER_FSM } from '../config/stateMachine';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class AdminOpsController {

  /**
   * FORCE UNASSIGN: Takes an order away from a driver and puts it back in the pool.
   * Use Case: Driver is not moving or phone is off.
   */
  public static async forceUnassign(req: Request, res: Response) {
    const { orderId } = req.params;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    try {
      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `admin:${adminId}:force_unassign:${orderId}:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      // Only unassign if not already delivered
      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        return res.status(400).json({ error: 'CANNOT_UNASSIGN_COMPLETED_ORDER' });
      }

      const originalDriverId = order.driverId;

      // M2 NOTE — DOCUMENTED FSM EXCEPTION (audited escalation):
      // Resetting to PENDING is an explicit recovery tool for dead/offline drivers.
      // PENDING is NOT reachable from ACCEPTED via ORDER_FSM, so this is a deliberate
      // bypass, fully audited by the FORCE_UNASSIGN AdminAuditLog entry below.
      order.driverId = undefined;
      order.status = OrderStatus.PENDING;
      await order.save();

      // Audit Log
      await AdminAuditLog.create({
        adminId,
        action: 'FORCE_UNASSIGN',
        targetId: order._id,
        targetModel: 'Order',
        details: `Removed driver ${originalDriverId} from order and reset to PENDING`,
      });

      // Real-time: Notify the original driver they are off the job
      if (originalDriverId) {
        getSocketService().io.to(originalDriverId.toString()).emit('order_revoked', { 
          orderId, 
          reason: 'Admin Intervention' 
        });
      }

      const responsePayload = { success: true, message: 'ORDER_RESET_TO_PENDING' };
      await writeIdempotency(lookupKey, responsePayload);
      res.status(200).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'UNASSIGN_FAILED' });
    }
  }

  /**
   * Fetch all jobs that are currently being handled by drivers
   */
  public static async getActiveOrders(req: Request, res: Response) {
    try {
      const activeStatuses = ['ACCEPTED', 'ARRIVED_AT_PICKUP', 'PICKED_UP', 'ARRIVED_AT_DROPOFF'];
      
      const orders = await Order.find({ status: { $in: activeStatuses } })
        .populate('customerId', 'displayName phoneNumber')
        .populate('driverId', 'displayName phoneNumber')
        .sort({ updatedAt: -1 });

      res.status(200).json({ success: true, count: orders.length, orders });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_ACTIVE_ORDERS_FAILED' });
    }
  }

  /**
   * ADMIN CANCEL: Kills an order entirely.
   */
  public static async adminCancelOrder(req: Request, res: Response) {
    const { orderId } = req.params;
    const { reason } = req.body;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    if (!reason) return res.status(400).json({ error: 'CANCELLATION_REASON_REQUIRED' });

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:cancel_order:${orderId}:${idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();
    try {
      const order = await Order.findById(orderId).session(session);
      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      // M2 — FSM GATE: CANCELLED is only legal from PENDING/ACCEPTED in ORDER_FSM.
      // Admin cancellation is an audited escalation (ADMIN_CANCEL log below), but
      // it must still follow the state machine so in-flight orders (PICKED_UP etc.)
      // cannot be silently killed; those require the PIN-gated settlement or a
      // FORCE_UNASSIGN recovery instead.
      const allowed = ORDER_FSM[order.status as OrderStatus];
      if (!allowed || !allowed.includes(OrderStatus.CANCELLED)) {
        return res.status(400).json({
          error: 'FSM_VIOLATION',
          message: `Cannot cancel an order in ${order.status} status.`
        });
      }

      // Refund escrow atomically (idempotent; no-op after settlement).
      // The order is set CANCELLED only after the refund ledger entry succeeds.
      await WalletService.releaseEscrow({
        order,
        reason: `Admin cancellation: ${reason}`,
        requestId: req.id,
        session
      });

      order.status = OrderStatus.CANCELLED;
      await order.save({ session });

      await AdminAuditLog.create({
        adminId,
        action: 'ADMIN_CANCEL',
        targetId: order._id,
        targetModel: 'Order',
        details: `Order cancelled by admin. Reason: ${reason}`,
      });

      // Notify both parties
      getSocketService().io.to(order.customerId.toString()).emit('order_cancelled', { orderId, reason });
      if (order.driverId) {
        getSocketService().io.to(order.driverId.toString()).emit('order_cancelled', { orderId, reason });
      }

      const responsePayload = { success: true, message: 'ORDER_CANCELLED' };
      await writeIdempotency(lookupKey, responsePayload, session);
      res.status(200).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'CANCEL_FAILED' });
    } finally {
      session.endSession();
    }
  }

  /**
   * DISPUTE FLAG: Freezes an order visually in the system for investigation.
   */
  public static async toggleDispute(req: Request, res: Response) {
    const { orderId } = req.params;
    const { isDisputed, note } = req.body;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey;

    try {
      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `admin:${adminId}:dispute:${orderId}:${idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      // Note: We'd ideally add 'isDisputed' and 'disputeNote' fields to the Order Model
      const order = await Order.findByIdAndUpdate(orderId, {
        $set: { isDisputed, disputeNote: note }
      }, { new: true });

      await AdminAuditLog.create({
        adminId,
        action: isDisputed ? 'FLAG_DISPUTE' : 'RESOLVE_DISPUTE',
        targetId: order?._id,
        targetModel: 'Order',
        details: note || 'Dispute status updated',
      });

      const responsePayload = { success: true, order };
      await writeIdempotency(lookupKey, responsePayload);
      res.status(200).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'DISPUTE_UPDATE_FAILED' });
    }
  }
}