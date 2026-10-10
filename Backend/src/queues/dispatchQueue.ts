import { Queue } from 'bullmq';
import { redisClient } from '../config/redis';

export const DISPATCH_QUEUE_NAME = 'dispatch-rounds';

export interface DispatchRoundJobData {
  orderId: string;
  roundNumber: number;
}

let queueInstance: Queue<DispatchRoundJobData> | null = null;

export function getDispatchQueue(): Queue<DispatchRoundJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<DispatchRoundJobData>(DISPATCH_QUEUE_NAME, {
      connection: redisClient as any,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return queueInstance;
}

export const dispatchQueue = {
  add: async (name: string, data: DispatchRoundJobData, opts?: any) => {
    return getDispatchQueue().add(name, data, opts);
  },
  getJob: async (jobId: string) => {
    return getDispatchQueue().getJob(jobId);
  },
};

/**
 * Enqueues a delayed round timer job in BullMQ.
 * Default delay is 15 seconds (15000ms).
 */
export async function scheduleRoundTimeout(
  orderId: string,
  roundNumber: number,
  delayMs: number = 15000
): Promise<string> {
  const jobId = `dispatch:${orderId}:round:${roundNumber}`;
  if (process.env.NODE_ENV === 'test') {
    return jobId;
  }
  const job = await getDispatchQueue().add(
    'round-timeout',
    { orderId, roundNumber },
    {
      delay: delayMs,
      jobId,
    }
  );
  return job.id || jobId;
}

/**
 * Attempts to remove any pending round timer job for an order.
 */
export async function cancelRoundTimeout(
  orderId: string,
  roundNumber: number
): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const jobId = `dispatch:${orderId}:round:${roundNumber}`;
  try {
    const job = await getDispatchQueue().getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (err: any) {
    console.warn(`[dispatchQueue] Could not cancel job ${jobId}:`, err.message);
  }
}

let preDispatchQueueInstance: Queue<any> | null = null;

export function getPreDispatchQueue(): Queue<any> {
  if (!preDispatchQueueInstance) {
    preDispatchQueueInstance = new Queue('pre-dispatch-unchain', {
      connection: redisClient as any,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return preDispatchQueueInstance;
}

/**
 * Enqueues a 5-minute unchaining timeout for a chained order.
 */
export async function scheduleUnchainTimeout(
  orderId: string,
  driverId: string,
  delayMs: number = 300000 // 5 minutes
): Promise<string> {
  const jobId = `unchain:${orderId}:${driverId}`;
  if (process.env.NODE_ENV === 'test') {
    return jobId;
  }
  const job = await getPreDispatchQueue().add(
    'unchain-timeout',
    { orderId, driverId },
    {
      delay: delayMs,
      jobId,
    }
  );
  return job.id || jobId;
}

/**
 * Cancels the unchaining timeout when primary order completes.
 */
export async function cancelUnchainTimeout(
  orderId: string,
  driverId: string
): Promise<void> {
  if (process.env.NODE_ENV === 'test') return;
  const jobId = `unchain:${orderId}:${driverId}`;
  try {
    const job = await getPreDispatchQueue().getJob(jobId);
    if (job) {
      await job.remove();
    }
  } catch (err: any) {
    console.warn(`[dispatchQueue] Could not cancel unchain job ${jobId}:`, err.message);
  }
}

