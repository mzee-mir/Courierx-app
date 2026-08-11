import { ClientSession } from "mongoose";
import { ImportRequest, ImportStatus } from "../models/ImportRequest";
import { Manifest } from "../models/Manifest";

export class BulkImportService {
  public static async processManifest(fileData: any[], manifestMeta: any, session: ClientSession) {
    const shipmentIds = [];

    for (const row of fileData) {
      // 1. Validate Idempotency (Duplicate Check)
      const existing = await ImportRequest.findOne({ 
        externalTrackingNumber: row.trackingNumber 
      }).session(session);
      
      if (existing) throw new Error(`DUPLICATE_TRACKING: ${row.trackingNumber}`);

      // 2. Validate Weight Requirement
      if (!row.weight || row.weight <= 0) throw new Error(`MISSING_WEIGHT: ${row.trackingNumber}`);

      // 3. Create Shipment
      const [shipment] = await ImportRequest.create([{
        externalTrackingNumber: row.trackingNumber,
        itemDescription: row.description,
        intake_weight: row.weight,
        userId: row.customerId, // Must be pre-validated
        partnerId: manifestMeta.partnerId,
        locationId: manifestMeta.originHub,
        currentLocationId: manifestMeta.originHub,
        status: ImportStatus.RECEIVED_AT_ORIGIN
      }], { session });

      shipmentIds.push(shipment._id);
    }

    // 4. Create Parent Manifest
    const [manifest] = await Manifest.create([{
      ...manifestMeta,
      shipmentIds
    }], { session });

    return manifest;
  }
}