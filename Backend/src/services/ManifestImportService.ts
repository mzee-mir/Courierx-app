import * as XLSX from 'xlsx';
import { User } from '../models/User';
import { ImportRequest } from '../models/ImportRequest';
import mongoose from 'mongoose';
import { PricingService } from './PartnerPricingService';


export class ManifestImportService {
  /**
   * validateAndParse: The "Pre-Flight" Check
   * Performs lookups for all customers and tracking numbers without writing to DB.
   */
  public static async validateAndParse(buffer: Buffer, partnerId: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);


    const results: { valid: any[], errors: any[] } = { valid: [], errors: [] };


    for (const [index, row] of (rows as any[]).entries()) {
      try {
        // 1. Logic Check: Does Customer Exist?
        const customer = await User.findOne({ phoneNumber: row.CustomerPhone }).select('_id');
        if (!customer) throw new Error(`Row ${index + 1}: Phone ${row.CustomerPhone} not found in CourierX`);


        // 2. Logic Check: Duplicate Tracking?
        const duplicate = await ImportRequest.findOne({ externalTrackingNumber: row.TrackingNumber });
        if (duplicate) throw new Error(`Row ${index + 1}: Tracking ${row.TrackingNumber} already exists`);


        // 3. Pricing Snapshot (Locking the rate card for this partner)
        const pricing = await PricingService.calculateSplitPrice({
          partnerId,
          weight: row.Weight,
          mode: row.Mode?.toUpperCase() === 'AIR' ? 'AIR' : 'SEA'
        });


        results.valid.push({ ...row, customerId: customer._id, pricing });
      } catch (err: any) {
        results.errors.push({ row: index + 1, message: err.message });
      }
    }
    return results;
  }
}
