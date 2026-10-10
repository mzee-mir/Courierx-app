import { Worker } from 'bullmq';
import { redisClient } from '../config/redis';
import { Order } from '../models/Order';
import { OrderOffer } from '../models/OrderOffer';
import { OrderStatus } from '../enums/OrderEnums';
import { DispatchService } from '../services/DispatchService';
import { getSocketService } from '../socketInstance';

export const PRE_DISPATCH_QUEUE_NAME = 'pre-dispatch-unchain';

export interface PreDispatchUnchainJobData {
  orderId: string;
  driverId: string;
}

/**
 * Worker that handles the 5-minute unchaining timeout:
 * If a driver accepts a chained order (CHAINED_RESERVED), but fails to complete
 * their primary delivery within 5 minutes, the chained order is released,
 * returned to PENDING, and re-enters Round 1 dispatch with zero penalty to the driver.
 */
export const preDispatchWorker = new Worker<PreDispatchUnchainJobData>(
  PRE_DISPATCH_QUEUE_NAME,
  async (job) => {
    const { orderId, driverId } = job.data;
    console.log(`[preDispatchWorker] Checking unchain timeout for Order ${orderId}, Driver ${driverId}`);

    const order = await Order.findById(orderId);
    if (!order) return;

    // Only unchain if the order is still in CHAINED_RESERVED state
    if (order.status !== OrderStatus.CHAINED_RESERVED) {
      console.log(`[preDispatchWorker] Order ${orderId} status is ${order.status}; unchain skipped.`);
      return;
    }

    console.warn(`[preDispatchWorker] Primary delivery stalled; unchaining Order ${orderId} from Driver ${driverId}`);

    // Release order back to PENDING and reset chained metadata
    order.status = OrderStatus.PENDING;
    order.isChained = false;
    order.chainedAssignedAt = undefined;
    order.driverId = undefined;
    order.dispatchStatus = 'DISPATCHING';
    order.dispatchRound = 1;
    await order.save();

    // Cancel offer record for this driver if active
    await OrderOffer.updateMany(
      { orderId: order._id, driverId, status: { $in: ['ACCEPTED', 'SENT', 'SEEN'] } },
      { $set: { status: 'CANCELLED' } }
    );

    // Notify driver that chained order was released
    try {
      getSocketService().io.to(driverId).emit('chained_order_released', {
        orderId,
        reason: 'PRIMARY_DELIVERY_TIMEOUT',
      });
    } catch (err: any) {
      console.warn('[preDispatchWorker] Socket emit chained_order_released warn:', err.message);
    }

    // Re-enter Round 1 dispatch
    await DispatchService.executeRound(orderId, 1);
  },
  { connection: redisClient as any }
);

preDispatchWorker.on('error', (err) => {
  console.error('[preDispatchWorker] Worker error:', err.message);
});

preDispatchWorker.on('failed', (job, err) => {
  console.error(`[preDispatchWorker] Job ${job?.id} failed:`, err.message);
});
