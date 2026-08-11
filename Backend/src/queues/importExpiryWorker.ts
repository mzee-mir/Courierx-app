import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { ShipmentLog } from '../models/ShipmentLog';
import { CustodyLog } from '../models/CustodyLog';
import mongoose from 'mongoose';

// Simple implementation for the cron worker
export const processExpiredDeclarations = async () => {
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      // Find all DECLARED shipments whose expiry date has passed
      const expiredShipments = await ImportRequest.find({
        status: ImportStatus.DECLARED,
        declarationExpiresAt: { $lt: new Date() }
      }).session(session);

      if (expiredShipments.length === 0) return;

      const shipmentIds = expiredShipments.map(s => s._id);

      // Update their status to EXPIRED
      await ImportRequest.updateMany(
        { _id: { $in: shipmentIds } },
        { 
          $set: { status: ImportStatus.EXPIRED },
          $push: {
            statusHistory: {
              status: ImportStatus.EXPIRED,
              changedAt: new Date(),
              changedBy: new mongoose.Types.ObjectId("000000000000000000000000"), // System ID
              changedByRole: 'SYSTEM',
              notes: 'Automatically expired due to TTL'
            }
          }
        },
        { session }
      );

      // Create CustodyLog entries
      const custodyLogs = expiredShipments.map(s => ({
        importId: s._id,
        fromStatus: ImportStatus.DECLARED,
        toStatus: ImportStatus.EXPIRED,
        changedBy: new mongoose.Types.ObjectId("000000000000000000000000"), // System ID
        changedAt: new Date(),
      }));
      await CustodyLog.insertMany(custodyLogs, { session });

      // Create ShipmentLogs for history/audit
      const shipmentLogs = expiredShipments.map(s => ({
        importRequestId: s._id,
        actorId: null, // System
        actorModel: 'System',
        oldStatus: ImportStatus.DECLARED,
        newStatus: ImportStatus.EXPIRED,
        notes: 'Declaration expired without receiving physical intake.',
        location: 'SYSTEM'
      }));
      await ShipmentLog.insertMany(shipmentLogs, { session });
    });
    
    console.log('[importExpiryWorker] Successfully processed expired declarations.');
  } catch (error) {
    console.error('[importExpiryWorker] Error processing expired declarations:', error);
  } finally {
    session.endSession();
  }
};
