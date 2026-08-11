import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { NotificationService } from '../services/notificationService';

// Escalation thresholds in milliseconds
const ESCALATION_THRESHOLDS = {
  REMINDER_1: 24 * 60 * 60 * 1000,       // 24h — gentle reminder
  REMINDER_2: 72 * 60 * 60 * 1000,       // 72h — urgent
  ADMIN_ALERT: 168 * 60 * 60 * 1000,     // 7 days — admin escalation + customer warning
};

/**
 * processReadyForDeliveryReminders: Runs twice daily.
 * Sends escalating push notifications to customers whose shipments 
 * are stuck in READY_FOR_LOCAL_HANDOFF.
 * 
 * Recommended schedule: '0 9,17 * * *' (9am and 5pm daily)
 */
export const processReadyForDeliveryReminders = async (): Promise<void> => {
  const now = Date.now();

  // Find all shipments in READY_FOR_LOCAL_HANDOFF that have been there > 24h
  const stuckShipments = await ImportRequest.find({
    status: ImportStatus.READY_FOR_LOCAL_HANDOFF,
    isFlagged: false,
    updatedAt: { $lt: new Date(now - ESCALATION_THRESHOLDS.REMINDER_1) }
  })
    .select('_id userId itemDescription updatedAt')
    .lean();

  if (stuckShipments.length === 0) {
    console.log('[importReminderWorker] No stuck shipments found.');
    return;
  }

  let reminder1Count = 0;
  let reminder2Count = 0;
  let adminAlertCount = 0;

  for (const shipment of stuckShipments) {
    const stuckMs = now - new Date(shipment.updatedAt).getTime();
    const userId = shipment.userId.toString();
    const importId = (shipment._id as any).toString();
    const item = shipment.itemDescription;

    if (stuckMs >= ESCALATION_THRESHOLDS.ADMIN_ALERT) {
      // Level 3: Admin alert + strong customer warning
      await NotificationService.sendToUser(
        userId,
        '🚨 Urgent: Package Awaiting Pickup',
        `Your "${item}" has been waiting for 7+ days. Please arrange delivery to avoid storage fees.`,
        { type: 'IMPORT_REMINDER', importId, escalation: 'LEVEL_3' }
      );
      // TODO: create internal admin alert (Phase 6)
      adminAlertCount++;
    } else if (stuckMs >= ESCALATION_THRESHOLDS.REMINDER_2) {
      // Level 2: Urgent nudge
      await NotificationService.sendToUser(
        userId,
        '⏰ Package Waiting — Pick Up Soon',
        `Your "${item}" has been ready for 3 days. Schedule delivery before storage fees apply.`,
        { type: 'IMPORT_REMINDER', importId, escalation: 'LEVEL_2' }
      );
      reminder2Count++;
    } else {
      // Level 1: Gentle reminder
      await NotificationService.sendToUser(
        userId,
        '📦 Your Package is Ready',
        `Your "${item}" is waiting at the local hub. Tap to arrange delivery.`,
        { type: 'IMPORT_REMINDER', importId, escalation: 'LEVEL_1' }
      );
      reminder1Count++;
    }
  }

  console.log(
    `[importReminderWorker] Sent reminders — ` +
    `L1: ${reminder1Count}, L2: ${reminder2Count}, L3 Admin: ${adminAlertCount}`
  );
};
