import mongoose, { ClientSession } from 'mongoose';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { OrderService } from './OrderService';
import { ShipmentLog } from '../models/ShipmentLog';
import { VehicleType } from '../enums/OrderEnums'; // 👈 Import the Enum
import { Order } from '../models/Order';

export class ImportService {

private static readonly VIRTUAL_TRANSIT_NODE_ID = "507f1f77bcf86cd799439011"; // A reserved ID for in-transit shipments

  /**
   * updateStatus: Synchronizes state with physical location nodes.
   */
  public static async updateStatus(data: {
    shipmentId: string,
    newStatus: ImportStatus,
    newLocationId: string, // Mandatory in request body for movement
    session: ClientSession
  }) {
    // RULE 2: Digital/Physical Sync
    const update = {
      status: data.newStatus,
      locationId: data.newLocationId 
    };

    const shipment = await ImportRequest.findOneAndUpdate(
      { _id: data.shipmentId },
      { $set: update },
      { session: data.session, new: true }
    );

    return shipment;
  }

  /**
   * handleLocalHandoff: The "Hard Boundary" between Cargo and CourierX.
   */
  public static async handleLocalHandoff(shipmentId: string) {
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        const shipment = await ImportRequest.findOneAndUpdate(
          { _id: shipmentId, status: 'READY_FOR_LOCAL_HANDOFF' },
          { status: 'HANDED_OFF' },
          { session, new: true }
        );

        if (!shipment) {
          throw new Error('HANDOFF_ALREADY_PROCESSED_OR_INVALID_STATE');
        }

        // 👈 FIX 2: Map lowercase string to uppercase Enum
        const vehicleMapping: Record<string, VehicleType> = {
          'bajaj': VehicleType.BAJAJ,
          'car': VehicleType.CAR,
          'truck': VehicleType.TRUCK
        };

        const assignedVehicle = vehicleMapping[shipment.preferredLocalVehicle] || VehicleType.BAJAJ;

        // Create local CourierX Order
        await OrderService.createOrder({
          customerId: shipment.userId.toString(),
          pickupLandmark: "Mogadishu Port - CourierX Terminal",
          pickupLocation: { type: 'Point', coordinates: [45.33, 2.03] }, 
          dropoffLandmark: shipment.dropoffLandmark,
          dropoffLocation: shipment.dropoffLocation,
          vehicleType: assignedVehicle, // 👈 Now matches the Enum type
          distanceKm: 5, 
          // @ts-ignore - assuming importReferenceId was added to Order schema in previous steps
          importReferenceId: shipment._id 
        });

        await ShipmentLog.create([{
          importRequestId: shipment._id,
          actorId: shipment.userId,
          actorModel: 'User',
          oldStatus: 'READY_FOR_LOCAL_HANDOFF',
          newStatus: 'HANDED_OFF',
          notes: 'International leg completed. Local delivery order generated.'
        }], { session });
      });
      
      return { success: true };
    } catch (error: any) {
      throw new Error(`HANDOFF_FAILED: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * setArrivalWeight: Strict integrity guard.
   */
  /**
   * RULE 5: Remove Auto-Heal Weight Logic
   */
  public static async setArrivalWeight(shipmentId: string, weight: number) {
    const shipment = await ImportRequest.findById(shipmentId);
    if (!shipment) throw new Error('NOT_FOUND');

    // BLOCKER: Integrity Check
    if (!shipment.intake_weight) {
      shipment.isFlagged = true;
      shipment.exceptionType = 'DATA_INTEGRITY_FAILURE';
      await shipment.save();
      
      // Stop execution and throw error to the partner
      throw new Error('INTAKE_DATA_MISSING_CONTACT_ADMIN');
    }

    shipment.arrival_weight = weight;
    const delta = Math.abs(shipment.intake_weight - weight);
    
    if (delta > 0.5) { 
      shipment.isFlagged = true;
      shipment.exceptionType = 'WEIGHT_DISCREPANCY';
    }

    await shipment.save();
  }

  public static async initiateLocalHandoff(shipmentId: string, actorId: string) {
    const session = await mongoose.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // 1. Fetch & Lock Shipment
        const shipment = await ImportRequest.findById(shipmentId).session(session);
        if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

        // 2. INTEGRITY CHECKS
        if (shipment.status !== ImportStatus.READY_FOR_LOCAL_HANDOFF) {
          throw new Error('INVALID_STATE_FOR_HANDOFF');
        }
        if (!shipment.arrival_weight) {
          throw new Error('DATA_INTEGRITY_ERROR: Arrival weight must be recorded before handoff.');
        }
        if (shipment.isFlagged) {
          throw new Error('SECURITY_LOCK: Cannot hand off a flagged shipment.');
        }

        // 3. CREATE LOCAL ORDER (The "CourierX" side)
        // We use the snapshot data so the local order is independent of future profile changes
        const localOrder = await Order.create([{
          customerId: shipment.userId,
          pickupLandmark: "CourierX Somalia Terminal",
          pickupLocation: { type: 'Point', coordinates: [45.3182, 2.0469] }, // Terminal GPS
          dropoffLandmark: shipment.resolverSnapshot?.deliveryLandmark,
          dropoffLocation: {
            type: 'Point',
            coordinates: shipment.resolverSnapshot?.deliveryCoords
          },
          vehicleType: shipment.preferredLocalVehicle,
          price: 5.00, // Fixed last-mile fee or calculated
          commission: 0.75,
          verificationPin: Math.floor(1000 + Math.random() * 9000).toString(),
          importShipmentId: shipment._id // 👈 Idempotency link
        }], { session });

        // 4. FINALIZE IMPORT RECORD
        shipment.status = ImportStatus.HANDED_OFF;
        shipment.localOrderId = localOrder[0]._id;
        // shipment.lockedAt = new Date(); // If you added this field
        await shipment.save({ session });

        // 5. IMMUTABLE LOG
        await ShipmentLog.create([{
          importRequestId: shipment._id,
          actorId,
          actorModel: 'User',
          oldStatus: ImportStatus.READY_FOR_LOCAL_HANDOFF,
          newStatus: ImportStatus.HANDED_OFF,
          notes: `Handed off to local CourierX Order: ${localOrder[0]._id}`
        }], { session });

        return { success: true, localOrderId: localOrder[0]._id };
      });
    } catch (error: any) {
      // Handle MongoDB Duplicate Key (Idempotency failure)
      if (error.code === 11000) throw new Error('ALREADY_HANDED_OFF');
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * RULE 3: Coupled State/Location Updates
   */
  public static async transitionStatus(data: {
    shipmentId: string,
    newStatus: ImportStatus,
    targetLocationId?: string,
    session: ClientSession
  }) {
    const update: any = { status: data.newStatus };

    // Automatic Location Management
    if (data.newStatus === ImportStatus.IN_TRANSIT) {
      // Move to a Virtual Node (Reserved ID or special name)
      update.currentLocationId = this.VIRTUAL_TRANSIT_NODE_ID; 
    } else if (data.targetLocationId) {
      update.currentLocationId = data.targetLocationId;
    }

    return await ImportRequest.findOneAndUpdate(
      { _id: data.shipmentId },
      { $set: update },
      { session: data.session, new: true }
    );
  }

  
}