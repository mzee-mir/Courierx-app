import cron from 'node-cron';
import { processExpiredDeclarations } from './importExpiryWorker';
import { processSlaBreach } from './importSlaWorker';
import { processReadyForDeliveryReminders } from './importReminderWorker';
import { PartnerMetricsWorker } from './partnerMetricsWorker';

export const startCronJobs = (): void => {
  console.log('[cronScheduler] Initializing background workers...');

  // 1. Expiry Worker: Runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('[cronScheduler] Running importExpiryWorker...');
    try {
      await processExpiredDeclarations();
    } catch (err: any) {
      console.error('[cronScheduler] importExpiryWorker failed:', err.message);
    }
  });

  // 2. SLA Monitoring Worker: Runs every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log('[cronScheduler] Running importSlaWorker...');
    try {
      await processSlaBreach();
    } catch (err: any) {
      console.error('[cronScheduler] importSlaWorker failed:', err.message);
    }
  });

  // 3. Ready for Delivery Escalation Worker: Runs daily at 9am and 5pm
  cron.schedule('0 9,17 * * *', async () => {
    console.log('[cronScheduler] Running importReminderWorker...');
    try {
      await processReadyForDeliveryReminders();
    } catch (err: any) {
      console.error('[cronScheduler] importReminderWorker failed:', err.message);
    }
  });

  // 4. Partner Metrics Worker: Runs every Monday at 3am
  cron.schedule('0 3 * * 1', async () => {
    console.log('[cronScheduler] Running partnerMetricsWorker...');
    try {
      await PartnerMetricsWorker.runWeeklyAggregation();
    } catch (err: any) {
      console.error('[cronScheduler] partnerMetricsWorker failed:', err.message);
    }
  });

  // 5. Driver Heartbeat Sweep: Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      const { transitionStaleDrivers } = await import('../models/DriverLocation');
      const result = await transitionStaleDrivers();
      if (result.markedOffline > 0 || result.markedStale > 0 || result.markedGrace > 0) {
        console.log(
          `[cronScheduler] Heartbeat sweep: ${result.markedOffline} offline, ${result.markedStale} stale, ${result.markedGrace} grace`
        );
      }
    } catch (err: any) {
      console.error('[cronScheduler] transitionStaleDrivers failed:', err.message);
    }
  });

  console.log('[cronScheduler] All background workers scheduled successfully.');
};

