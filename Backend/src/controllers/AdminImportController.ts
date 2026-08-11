import { Request, Response } from 'express';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { CargoPartner } from '../models/CargoPartner';
import { AdminAuditLog } from '../models/AdminAuditLog';
import mongoose from 'mongoose';
import { Manifest } from '../models/Manifest';
import { MANIFEST_FSM, ManifestStatus } from '../config/stateMachine';
import { ShipmentLog } from '../models/ShipmentLog';

export class AdminImportController {

  /**
   * PARTNER MANAGEMENT: Add a new logistics company to the system.
   */
  public static async createPartner(req: Request, res: Response) {
    try {
      const partner = await CargoPartner.create(req.body);
      res.status(201).json({ success: true, partner });
    } catch (error) {
      res.status(400).json({ error: 'CREATE_PARTNER_FAILED' });
    }
  }

  /**
   * SHIPMENT ASSIGNMENT: Link a shipment to specific partners.
   */
  public static async assignPartners(req: Request, res: Response) {
    const { requestId } = req.params;
    const { chinaAgentId, freightPartnerId, clearingAgentId } = req.body;
    const adminId = req.user?.userId;

    try {
      const request = await ImportRequest.findById(requestId);
      if (!request) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      // Update assignments
      if (chinaAgentId) request.chinaAgentId = chinaAgentId;
      if (freightPartnerId) request.freightPartnerId = freightPartnerId;
      if (clearingAgentId) request.clearingAgentId = clearingAgentId;

      await request.save();

      await AdminAuditLog.create({
        adminId,
        action: 'ASSIGN_IMPORT_PARTNERS',
        targetId: request._id,
        targetModel: 'ImportRequest',
        details: `Assigned partners to shipment ${request.externalTrackingNumber}`,
      });

      res.status(200).json({ success: true, request });
    } catch (error) {
      res.status(500).json({ error: 'ASSIGNMENT_FAILED' });
    }
  }

  /**
   * consolidateManifest: Groups individual packages into a physical transport unit.
   * Logic: "One Manifest = One Mode."
   */
  public static async consolidateManifest(req: Request, res: Response) {
    const { manifestCode, originHub, destinationHub, shippingMode, shipmentIds, metadata } = req.body;
    const adminId = req.user?.userId;
    const partnerId = req.user?.partnerId;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. DATA INTEGRITY CHECK: Fetch all target shipments
        const shipments = await ImportRequest.find({
          _id: { $in: shipmentIds }
        }).session(session);

        if (shipments.length !== shipmentIds.length) {
          throw new Error('INTEGRITY_ERROR: Some shipment IDs are invalid.');
        }

        // 2. ARCHITECTURAL GUARDRAILS
        for (const shipment of shipments) {
          // Rule A: Status Check
          if (shipment.status !== ImportStatus.RECEIVED_AT_ORIGIN) {
            throw new Error(`FLOW_ERROR: Shipment ${shipment.externalTrackingNumber} is not in RECEIVED state.`);
          }
          // Rule B: Exception Lock
          if (shipment.isFlagged) {
            throw new Error(`SECURITY_LOCK: Shipment ${shipment.externalTrackingNumber} is frozen and cannot be consolidated.`);
          }
          // Rule C: Multi-Modal Mismatch
          if (shipment.transportMode !== shippingMode) {
            throw new Error(`MODAL_MISMATCH: Shipment ${shipment.externalTrackingNumber} is assigned to ${shipment.transportMode}, but this manifest is ${shippingMode}.`);
          }
        }

        // 3. CREATE PARENT MANIFEST
        const [manifest] = await Manifest.create([{
          manifestCode,
          originHub,
          partnerId,
          destinationHub,
          shippingMode,
          status: ManifestStatus.CONSOLIDATED,
          shipmentIds,
          metadata
        }], { session });

        // 4. BULK UPDATE CHILD SHIPMENTS
        // Bind to manifest and move to CONSOLIDATED state
        await ImportRequest.updateMany(
          { _id: { $in: shipmentIds } },
          {
            $set: {
              status: ImportStatus.CONSOLIDATED,
              manifestId: manifest._id
            }
          },
          { session }
        );

        // 5. IMMUTABLE LOGGING
        await AdminAuditLog.create([{
          adminId,
          action: 'CONSOLIDATE_MANIFEST',
          targetId: manifest._id,
          targetModel: 'Manifest',
          details: `Created ${shippingMode} manifest ${manifestCode} with ${shipmentIds.length} items.`,
          requestId: req.id
        }], { session });

        // Create individual shipment events for the customer timeline
        const shipmentEvents = shipmentIds.map((id: string) => ({
          importRequestId: id,
          actorId: adminId,
          actorModel: 'User',
          oldStatus: ImportStatus.RECEIVED_AT_ORIGIN,
          newStatus: ImportStatus.CONSOLIDATED,
          location: `Consolidation Center: ${originHub}`,
          notes: `Packed into Manifest: ${manifestCode}`
        }));
        await ShipmentLog.insertMany(shipmentEvents, { session });
      });

      res.status(201).json({
        success: true,
        message: 'MANIFEST_LOCKED',
        count: shipmentIds.length
      });

    } catch (error: any) {
      res.status(400).json({ error: 'CONSOLIDATION_FAILED', message: error.message });
    } finally {
      session.endSession();
    }
  }


  public static async getActiveManifests(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;
      console.log("--- MANIFEST DIRECTORY DEBUG ---");
      console.log("Current Partner ID from Token:", partnerId);

      if (!partnerId) {
        return res.status(403).json({ error: 'ORG_CONTEXT_MISSING' });
      }

      // Use a flexible query: Matches if partnerId is a String OR an ObjectId
      const query = {
        $or: [
          { partnerId: partnerId },
          { partnerId: new mongoose.Types.ObjectId(partnerId as string) }
        ]
      };

      const manifests = await Manifest.find(query)
        .populate('originHub')
        .populate('destinationHub')
        .sort({ createdAt: -1 })
        .lean();

      console.log(`Successfully found ${manifests.length} manifests`);

      res.status(200).json({
        success: true,
        manifests: manifests.map(m => ({
          id: m._id.toString(),
          manifestCode: m.manifestCode || 'N/A',
          status: m.status || 'DRAFT',
          shippingMode: m.shippingMode || 'AIR',
          shipmentIds: m.shipmentIds || [],
          // FIX: Use real timestamp, not version number
          updatedAt: m.updatedAt || m.createdAt
        }))
      });

    } catch (error: any) {
      // 🚨 CHECK YOUR TERMINAL FOR THIS OUTPUT:
      console.error("CRITICAL_DB_ERROR:", error.message);
      console.error("ERROR_STACK:", error.stack);

      res.status(500).json({
        error: 'FETCH_FAILED',
        details: error.message // This will show in your browser Network tab
      });
    }
  }

  /**
   * initializeManifestDraft: Creates an empty container in the DB.
   */
  public static async initializeManifestDraft(req: Request, res: Response) {
    const { shippingMode, originHub, destinationHub } = req.body;
    const partnerId = req.user?.partnerId;

    // 1. VALIDATION GUARD: Check if IDs are valid ObjectIds
    if (!mongoose.Types.ObjectId.isValid(originHub) || !mongoose.Types.ObjectId.isValid(destinationHub)) {
      return res.status(400).json({
        error: 'INVALID_LOCATION_ID',
        message: 'The selected Hub IDs are not valid database identifiers.'
      });
    }

    try {
      const draft = await Manifest.create({
        manifestCode: `DRAFT-${Date.now().toString().slice(-4)}`,
        originHub: new mongoose.Types.ObjectId(originHub), // 👈 Force cast to ObjectId
        destinationHub: new mongoose.Types.ObjectId(destinationHub),
        shippingMode,
        status: ManifestStatus.DRAFT,
        shipmentIds: [],
        partnerId
      });

      res.status(201).json({ success: true, draftId: draft._id });
    } catch (error) {
      console.error("DRAFT_INIT_ERROR:", error);
      res.status(500).json({ error: 'DATABASE_WRITE_FAILED' });
    }
  }

  /**
   * updateManifestDraft: Adds/Removes items from the draft.
   */
  public static async updateManifestDraft(req: Request, res: Response) {
    const { id } = req.params;
    const { shipmentIds, metadata } = req.body;

    // RULE: Only update if still in DRAFT status
    const draft = await Manifest.findOneAndUpdate(
      { _id: id, status: ManifestStatus.DRAFT },
      { $set: { shipmentIds, metadata } },
      { new: true }
    );

    if (!draft) return res.status(400).json({ error: 'MANIFEST_ALREADY_SEALED' });
    res.json({ success: true, draft });
  }

  public static async getManifestAuthority(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = req.user!;

      // 1. Fetch Manifest + Shipments + Events
      const [manifest, logs] = await Promise.all([
        Manifest.findById(id)
          .populate('shipmentIds', 'externalTrackingNumber intake_weight status isFlagged exceptionType')
          .populate('originHub', 'name country')
          .populate('destinationHub', 'name country')
          .lean(),
        AdminAuditLog.find({ targetId: id, targetModel: 'Manifest' }).sort({ createdAt: 1 }).lean()
      ]);

      // 👈 THE FIX: Stop the crash if ID is 'undefined' or malformed
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          error: 'INVALID_ID_FORMAT',
          message: `ID '${id}' is not a valid MongoDB identifier.`
        });
      }

      if (!manifest) return res.status(404).json({ error: 'MANIFEST_NOT_FOUND' });

      // 2. Derive Allowed Transitions (Server-Side Truth)
      // China staff can move DRAFT -> CONSOLIDATED -> DEPARTED
      // Somalia staff can move DEPARTED -> ARRIVED -> DISMANTLED
      const nextStates = MANIFEST_FSM[manifest.status as ManifestStatus] || [];

      // 3. Weight Calculation (Integrity Signal)
      const calculatedTotalWeight = manifest.shipmentIds.reduce((acc: number, s: any) => {
        // Use Number() to ensure math works even if the DB value is a string
        const weight = Number(s.intake_weight) || 0;
        return acc + weight;
      }, 0);

      res.status(200).json({
        success: true,
        data: {
          manifest,
          logs,
          calculatedTotalWeight,
          allowed: nextStates.map(state => ({
            code: state,
            label: `MARK_AS_${state}`,
            isIrreversible: true
          }))
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'AUTHORITY_CHECK_FAILED' });
    }
  }

  /**
 * sealManifest: Transitions a DRAFT into a committed CONSOLIDATED manifest.
 * This is the "Point of No Return" for the warehouse floor.
 */

  public static async sealManifest(req: Request, res: Response) {
    const { id } = req.params;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const manifest = await Manifest.findById(id).session(session);
        if (!manifest) throw new Error('MANIFEST_NOT_FOUND');

        // 1. LATCH: Prevent sealing a manifest twice or an empty one
        if (manifest.status !== 'DRAFT') throw new Error('MANIFEST_ALREADY_SEALED');
        if (manifest.shipmentIds.length === 0) throw new Error('MANIFEST_IS_EMPTY');

        // 2. PARENT UPDATE
        manifest.status = 'CONSOLIDATED' as any; // Using your ManifestStatus enum
        await manifest.save({ session });

        // 3. 🛡️ BATCH PROPAGATION: The most important step
        // Update ALL individual packages inside the manifest to 'CONSOLIDATED'
        await ImportRequest.updateMany(
          { _id: { $in: manifest.shipmentIds } },
          { $set: { status: 'CONSOLIDATED' } },
          { session }
        );

        // 4. AUDIT TRAIL
        await AdminAuditLog.create([{
          adminId: req.user?.userId,
          action: 'MANIFEST_SEALED',
          targetId: manifest._id,
          targetModel: 'Manifest',
          details: `Batch sealed with ${manifest.shipmentIds.length} items.`,
          requestId: req.id
        }], { session });
      });

      res.status(200).json({ success: true, message: 'MANIFEST_SEALED_SUCCESSFULLY' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
 * getManifestDetail: Detailed view of a sealed batch.
 */
  public static async getManifestDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const manifest = await Manifest.findById(id)
        .populate('originHub', 'name city country')
        .populate('destinationHub', 'name city country')
        .populate('shipmentIds', 'externalTrackingNumber intake_weight status itemDescription')
        .lean();

      if (!manifest) return res.status(404).json({ error: 'MANIFEST_NOT_FOUND' });

      res.status(200).json({ success: true, data: manifest });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_FAILED' });
    }
  }

  /**
   * transitionManifest: Moves the entire batch to the next leg.
   * Logic: All child shipments inherit the status change.
   */
  public static async transitionManifest(req: Request, res: Response) {
    const { id } = req.params;
    const actionTrigger = req.body.actionCode || req.body.nextStatus;
    const user = req.user!;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const manifest = await Manifest.findById(id).session(session);
        if (!manifest) throw new Error('MANIFEST_NOT_FOUND');

        const userLocations = user.assignedLocations.map(l => l.toString());
        const isOriginStaff = userLocations.includes(manifest.originHub.toString());
        const isDestinationStaff = userLocations.includes(manifest.destinationHub.toString());

        // --- RULE 1: Node-Specific Authorization ---
        if (actionTrigger.includes('DEPART') && !isOriginStaff) {
          throw new Error('AUTHORITY_VIOLATION: Only Origin Hub staff can execute Dispatch.');
        }
        if ((actionTrigger.includes('ARRIVE') || actionTrigger.includes('DISMANTLE')) && !isDestinationStaff) {
          throw new Error('AUTHORITY_VIOLATION: Only Destination Hub staff can acknowledge Arrival/Dismantling.');
        }

        // Map action to status
        let targetState: ManifestStatus;
        if (actionTrigger.includes('DEPART')) targetState = ManifestStatus.DEPARTED;
        else if (actionTrigger.includes('ARRIVE')) targetState = ManifestStatus.ARRIVED;
        else if (actionTrigger.includes('DISMANTLE')) targetState = ManifestStatus.DISMANTLED;
        else targetState = actionTrigger as ManifestStatus;

        const oldStatus = manifest.status;
        manifest.status = targetState;
        await manifest.save({ session });

        // --- RULE 2: Child Propagation (Status & Location) ---
        let shipmentUpdate: any = {};

        if (targetState === ManifestStatus.DEPARTED) {
          shipmentUpdate = {
            status: ImportStatus.IN_TRANSIT,
            currentLocationId: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011") // Virtual Node
          };
        }
        else if (targetState === ManifestStatus.ARRIVED) {
          shipmentUpdate = {
            status: ImportStatus.ARRIVED_LOCAL,
            currentLocationId: manifest.destinationHub // 👈 Move custody to Somalia Hub
          };
        }

        if (Object.keys(shipmentUpdate).length > 0) {
          await ImportRequest.updateMany(
            { _id: { $in: manifest.shipmentIds } },
            { $set: shipmentUpdate },
            { session }
          );
        }

        await AdminAuditLog.create([{
          adminId: user.userId,
          action: 'MANIFEST_MOVE',
          targetId: manifest._id,
          targetModel: 'Manifest',
          details: `Batch moved from ${oldStatus} to ${targetState} by ${user.name}`,
          requestId: req.id
        }], { session });
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: 'TRANSITION_FAILED', message: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
   * MONITORING: Get all shipments that are stuck (no China agent assigned).
   */
  public static async getUnassignedImports(req: Request, res: Response) {
    try {
      const unassigned = await ImportRequest.find({
        chinaAgentId: { $exists: false }
      }).populate('userId', 'displayName phoneNumber');

      res.status(200).json({ success: true, count: unassigned.length, shipments: unassigned });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_UNASSIGNED_FAILED' });
    }
  }
}