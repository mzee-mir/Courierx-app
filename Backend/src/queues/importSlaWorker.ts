import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { SlaAlert } from '../models/SlaAlert';
import mongoose from 'mongoose';


// SLA thresholds in milliseconds (configurable via SystemSettings in the future)
const SLA_THRESHOLDS: Partial<Record<ImportStatus, number>> = {
  [ImportStatus.IN_TRANSIT]:                 21 * 24 * 60 * 60 * 1000,  // 21 days
  [ImportStatus.CUSTOMS_HOLD]:                5 * 24 * 60 * 60 * 1000,  //  5 days
  [ImportStatus.ARRIVED_LOCAL]:               3 * 24 * 60 * 60 * 1000,  //  3 days
  [ImportStatus.READY_FOR_LOCAL_HANDOFF]:     7 * 24 * 60 * 60 * 1000,  //  7 days
};

interface SlaAlert {
  importId: mongoose.Types.ObjectId;
  externalTrackingNumber: string;
  status: string;
  stuckSinceMs: number;
  thresholdMs: number;
  daysOverdue: number;
}

/**
 * processSlaBreach: Scans for shipments that have breached their SLA threshold.
 * Recommended schedule: every 6 hours via cron.
 */
export const processSlaBreach = async (): Promise<void> => {
  const alerts: SlaAlert[] = [];
  const now = Date.now();

  for (const [status, thresholdMs] of Object.entries(SLA_THRESHOLDS)) {
    const cutoffDate = new Date(now - thresholdMs);

    // Find shipments in this status that haven't moved since the cutoff date
    const stalledShipments = await ImportRequest.find({
      status,
      updatedAt: { $lt: cutoffDate },
      isFlagged: false, // skip already-flagged exceptions — they are manually handled
    })
      .select('_id externalTrackingNumber status updatedAt userId partnerId')
      .lean();

    for (const shipment of stalledShipments) {
      const stuckSinceMs = now - new Date(shipment.updatedAt).getTime();
      alerts.push({
        importId: shipment._id as mongoose.Types.ObjectId,
        externalTrackingNumber: shipment.externalTrackingNumber,
        status: shipment.status,
        stuckSinceMs,
        thresholdMs,
        daysOverdue: Math.floor((stuckSinceMs - thresholdMs) / (24 * 60 * 60 * 1000)),
      });
    }
  }

  if (alerts.length === 0) {
    console.log('[importSlaWorker] No SLA breaches detected.');
    return;
  }

  // Log breaches and create internal alert records
  const alertDocs = alerts.map(a => ({
    importId: a.importId,
    externalTrackingNumber: a.externalTrackingNumber,
    status: a.status,
    daysOverdue: a.daysOverdue,
    detectedAt: new Date(),
    resolved: false,
  }));

  await SlaAlert.insertMany(alertDocs, { ordered: false }).catch(err =>
    console.error('[importSlaWorker] Failed to persist SLA alerts:', err.message)
  );

  console.log(`[importSlaWorker] Detected and recorded ${alerts.length} SLA breach(es).`);
};
