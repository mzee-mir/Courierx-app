import { Worker } from 'bullmq';
import { redisClient } from '../config/redis';
import { DISPATCH_QUEUE_NAME } from './dispatchQueue';
import { DispatchService } from '../services/DispatchService';

export const dispatchWorker = new Worker(
  DISPATCH_QUEUE_NAME,
  async (job) => {
    const { orderId, roundNumber } = job.data;
    console.log(`[dispatchWorker] Processing timeout for Order ${orderId}, Round ${roundNumber}`);
    await DispatchService.handleRoundTimeout(orderId, roundNumber);
  },
  { connection: redisClient as any }
);

dispatchWorker.on('error', (err) => {
  console.error('[dispatchWorker] Worker error:', err.message);
});

dispatchWorker.on('failed', (job, err) => {
  console.error(`[dispatchWorker] Job ${job?.id} failed:`, err.message);
});
