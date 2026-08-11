import { PartnerOrganization } from '../models/PartnerOrganization';
import { SystemSettings } from '../models/SystemSettings';
import mongoose from 'mongoose';

export class PricingService {
  /**
   * Helper to calculate volumetric vs actual weight
   */
  public static calculateChargeableWeight(actualKg: number, dimensions: { l: number; w: number; h: number }, divisor: number = 5000): number {
    const volumetricKg = (dimensions.l * dimensions.w * dimensions.h) / divisor;
    return Math.max(actualKg, volumetricKg);
  }

  /**
   * Helper to estimate customs duty
   */
  public static async estimateCustoms(hsCode: string, declaredValue: number): Promise<number> {
    if (!declaredValue || declaredValue <= 0) return 0;
    const { CustomsTax } = require('../models/CustomsTax');
    const tax = await CustomsTax.findOne({ hsCode, isActive: true });
    
    // Default to 0 if HS Code not found or not active
    const dutyPercentage = tax ? tax.dutyPercentage : 0; 
    return Number(((declaredValue * dutyPercentage) / 100).toFixed(2));
  }

  /**
   * Main calculation engine for both AIR (Weight) and SEA (CBM)
   */
  public static async calculateSplitPrice(data: {
    partnerId: string;
    weight: number;
    mode: 'AIR' | 'SEA';
    dimensions?: { l: number; w: number; h: number };
  }) {
    // 1. Fetch System Settings
    const [ceiling, systemAddOnSetting] = await Promise.all([
      SystemSettings.findOne({ key: 'PRICE_CEILING_PER_KG', isActive: true }),
      SystemSettings.findOne({ key: 'SYSTEM_ADD_ON_PER_KG', isActive: true })
    ]);

    const globalCeiling = ceiling?.value || 15.00;
    const globalAddOn = systemAddOnSetting?.value || 0.50; // Default $0.50/unit if not found

    // 2. Fetch Partner Organization and Rate Card
    const partner = await PartnerOrganization.findById(data.partnerId).lean();
    if (!partner) throw new Error('PARTNER_NOT_FOUND');

    const { PartnerRateCard } = require('../models/PartnerRateCard');
    const activeRateCard = await PartnerRateCard.findOne({ partnerId: data.partnerId, isActive: true }).lean();
    const volumetricDivisor = activeRateCard?.volumetricDivisor || 5000;

    let chargeableUnits = 0;
    let baseRate = 0;
    let calculatedCBM = 0;

    // 3. Logic Branch: AIR vs SEA
    if (data.mode === 'SEA') {
      if (!data.dimensions) throw new Error("SEA_MODE_REQUIRES_DIMENSIONS");

      const { l, w, h } = data.dimensions;
      calculatedCBM = (Number(l) * Number(w) * Number(h)) / 1000000;

      const minCBM = partner.seaConfig?.minCBM || 0.1;
      chargeableUnits = Math.max(calculatedCBM, minCBM);
      baseRate = partner.requestedSeaRate;
    } else {
      // AIR Mode uses weight
      if (data.dimensions) {
        chargeableUnits = PricingService.calculateChargeableWeight(data.weight, data.dimensions, volumetricDivisor);
      } else {
        chargeableUnits = data.weight;
      }
      baseRate = partner.requestedAirRate;
    }

    // 4. Ceiling Verification
    if (baseRate > globalCeiling) {
      throw new Error(`PRICE_CEILING_VIOLATION: Rate $${baseRate} exceeds system limit of $${globalCeiling}`);
    }

    // 5. Calculate Split
    const partnerTotal = chargeableUnits * baseRate;
    const systemTotal = chargeableUnits * globalAddOn;
    const finalPrice = partnerTotal + systemTotal;

    return {
      totalCustomerPaid: Number(finalPrice.toFixed(2)),
      partnerShare: Number(partnerTotal.toFixed(2)),
      systemShare: Number(systemTotal.toFixed(2)),
      appliedRate: baseRate,
      appliedAddOn: globalAddOn,
      calculatedCBM: Number(calculatedCBM.toFixed(3)),
      chargeableUnits
    };
  }
}