import { Request, Response } from 'express';
import { Order } from '../models/Order';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { OrderStatus } from '../enums/OrderEnums';
import mongoose from 'mongoose';
import { socketService } from '..'; // To notify drivers instantly

export class AdminOpsController {

  /**
   * FORCE UNASSIGN: Takes an order away from a driver and puts it back in the pool.
   * Use Case: Driver is not moving or phone is off.
   */
  public static async forceUnassign(req: Request, res: Response) {
    const { orderId } = req.params;
    const adminId = req.user?.userId;

    try {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      // Only unassign if not already delivered
      if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
        return res.status(400).json({ error: 'CANNOT_UNASSIGN_COMPLETED_ORDER' });
      }

      const originalDriverId = order.driverId;

      // Update Order
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
        socketService.io.to(originalDriverId.toString()).emit('order_revoked', { 
          orderId, 
          reason: 'Admin Intervention' 
        });
      }

      res.status(200).json({ success: true, message: 'ORDER_RESET_TO_PENDING' });
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

    if (!reason) return res.status(400).json({ error: 'CANCELLATION_REASON_REQUIRED' });

    try {
      const order = await Order.findById(orderId);
      if (!order) return res.status(404).json({ error: 'ORDER_NOT_FOUND' });

      order.status = OrderStatus.CANCELLED;
      await order.save();

      await AdminAuditLog.create({
        adminId,
        action: 'ADMIN_CANCEL',
        targetId: order._id,
        targetModel: 'Order',
        details: `Order cancelled by admin. Reason: ${reason}`,
      });

      // Notify both parties
      socketService.io.to(order.customerId.toString()).emit('order_cancelled', { orderId, reason });
      if (order.driverId) {
        socketService.io.to(order.driverId.toString()).emit('order_cancelled', { orderId, reason });
      }

      res.status(200).json({ success: true, message: 'ORDER_CANCELLED' });
    } catch (error) {
      res.status(500).json({ error: 'CANCEL_FAILED' });
    }
  }

  /**
   * DISPUTE FLAG: Freezes an order visually in the system for investigation.
   */
  public static async toggleDispute(req: Request, res: Response) {
    const { orderId } = req.params;
    const { isDisputed, note } = req.body;
    const adminId = req.user?.userId;

    try {
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

      res.status(200).json({ success: true, order });
    } catch (error) {
      res.status(500).json({ error: 'DISPUTE_UPDATE_FAILED' });
    }
  }
}