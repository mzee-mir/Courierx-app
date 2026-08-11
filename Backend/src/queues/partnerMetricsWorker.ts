import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { PartnerMetrics } from '../models/PartnerMetrics';
import { PartnerOrganization } from '../models/PartnerOrganization';

export class PartnerMetricsWorker {
  /**
   * Calculates performance metrics per partner for the past 7 days.
   * Runs weekly via cron or on-demand.
   */
  public static async runWeeklyAggregation() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      const activePartners = await PartnerOrganization.find({ status: 'ACTIVE' });

      for (const partner of activePartners) {
        const partnerId = partner._id;

        // Fetch imports updated or created in the past 7 days for this partner
        const imports = await ImportRequest.find({
          partnerId,
          updatedAt: { $gte: weekAgo }
        }).lean();

        const totalVolume = imports.length;
        if (totalVolume === 0) continue;

        let totalAirDays = 0, airCount = 0;
        let totalSeaDays = 0, seaCount = 0;
        let weightDisputeCount = 0;
        let lostCount = 0;
        let totalIntakeHours = 0, intakeCount = 0;

        for (const shipment of imports) {
          // Check for weight dispute / loss
          if (shipment.status === ImportStatus.WEIGHT_DISPUTE || shipment.statusHistory.some((h: any) => h.status === ImportStatus.WEIGHT_DISPUTE)) {
            weightDisputeCount++;
          }
          if (shipment.status === ImportStatus.LOST) {
            lostCount++;
          }

          // Calculate Intake SLA (DECLARED -> RECEIVED_AT_ORIGIN)
          const declaredEntry = shipment.statusHistory.find((h: any) => h.status === ImportStatus.DECLARED);
          const intakeEntry = shipment.statusHistory.find((h: any) => h.status === ImportStatus.RECEIVED_AT_ORIGIN);
          if (declaredEntry && intakeEntry) {
            const hrs = (new Date(intakeEntry.changedAt).getTime() - new Date(declaredEntry.changedAt).getTime()) / (1000 * 60 * 60);
            totalIntakeHours += hrs;
            intakeCount++;
          }

          // Calculate Transit Time (IN_TRANSIT -> ARRIVED_LOCAL)
          const transitEntry = shipment.statusHistory.find((h: any) => h.status === ImportStatus.IN_TRANSIT);
          const arrivedEntry = shipment.statusHistory.find((h: any) => h.status === ImportStatus.ARRIVED_LOCAL);
          if (transitEntry && arrivedEntry) {
            const days = (new Date(arrivedEntry.changedAt).getTime() - new Date(transitEntry.changedAt).getTime()) / (1000 * 60 * 60 * 24);
            if (shipment.transportMode === 'AIR') {
              totalAirDays += days;
              airCount++;
            } else {
              totalSeaDays += days;
              seaCount++;
            }
          }
        }

        const avgAirTransit = airCount > 0 ? Number((totalAirDays / airCount).toFixed(1)) : 0;
        const avgSeaTransit = seaCount > 0 ? Number((totalSeaDays / seaCount).toFixed(1)) : 0;
        const weightDisputeRate = Number(((weightDisputeCount / totalVolume) * 100).toFixed(1));
        const packageLossRate = Number(((lostCount / totalVolume) * 100).toFixed(1));
        const avgIntakeHours = intakeCount > 0 ? Number((totalIntakeHours / intakeCount).toFixed(1)) : 0;

        await PartnerMetrics.findOneAndUpdate(
          { partnerId, weekStartDate: weekAgo },
          {
            partnerId,
            weekStartDate: weekAgo,
            weekEndDate: now,
            totalVolume,
            averageTransitTimeDays: { AIR: avgAirTransit, SEA: avgSeaTransit },
            weightDisputeRate,
            packageLossRate,
            averageIntakeHours: avgIntakeHours
          },
          { upsert: true, new: true }
        );
      }

      console.log(`[PartnerMetricsWorker] Weekly partner metrics aggregation complete at ${now.toISOString()}`);
    } catch (error) {
      console.error('[PartnerMetricsWorker] Aggregation failed:', error);
    }
  }
}
