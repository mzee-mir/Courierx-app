import { Worker } from 'bullmq';
import { redisClient } from '../config/redis';
import { ImportRequest } from '../models/ImportRequest';
import mongoose from 'mongoose';

export const importWorker = new Worker('manifest-processing', async (job) => {
  const { shipments, adminId, partnerId, locationId } = job.data;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      for (const data of shipments) {
        await ImportRequest.create([{
          userId: data.customerId,
          partnerId,
          locationId,
          currentLocationId: locationId,
          externalTrackingNumber: data.TrackingNumber,
          itemDescription: data.ItemCategory,
          intake_weight: data.Weight,
          pricingSnapshot: data.pricing, // 👈 Locked rate from Dry Run
          intakeMethod: 'BULK_MANIFEST',
          status: 'RECEIVED_AT_ORIGIN'
        }], { session });
      }
    });
    console.log(`[JOB:${job.id}] Successfully processed ${shipments.length} shipments.`);
  } catch (error) {
    console.error(`[JOB:${job.id}] Critical Failure:`, error);
    throw error; // BullMQ will retry based on config
  } finally {
    session.endSession();
  }
}, { connection: redisClient });