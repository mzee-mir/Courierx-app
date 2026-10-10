import { Request, Response } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { PartnerOrganization } from '../models/PartnerOrganization';
import { PartnerLocation } from '../models/PartnerLocation';
import { User, UserRole } from '../models/User';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { IMPORT_FSM, ORDER_FSM } from '../config/stateMachine';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class AdminPartnerController {
  /**
   * onboardPartnerOrg: Atomic creation of the supply chain entity.
   */
  public static async onboardPartnerOrg(req: Request, res: Response) {
    const { orgName, location, ownerEmail, password } = req.body;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Create Organization
        const [org] = await PartnerOrganization.create([{ name: orgName }], { session });

        // 2. Create physical custody node (Warehouse/Port)
        const [loc] = await PartnerLocation.create([{ 
          ...location, 
          orgId: org._id 
        }], { session });

        // 3. Create Partner Owner User
        const hashedPassword = await bcrypt.hash(password, 12);
        await User.create([{
          email: ownerEmail,
          password: hashedPassword,
          roles: [UserRole.MERCHANT],
          partnerId: org._id,
          assignedLocations: [loc._id],
          isVerified: true,
          firebaseUid: `PARTNER_${Date.now()}`
        }], { session });

        await AdminAuditLog.create([{
          adminId: req.user?.userId,
          action: 'ONBOARD_PARTNER',
          targetId: org._id,
          targetModel: 'PartnerOrganization',
          details: `Onboarded ${orgName} with location ${location.name}`,
          requestId: req.id
        }], { session });
      });

      res.status(201).json({ success: true, message: 'PARTNER_ENTITY_CREATED' });
    } catch (error: any) {
      res.status(400).json({ error: 'ONBOARDING_FAILED', message: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
   * resolveException: Unfreezes a shipment.
   * Restricted to: SUPER_ADMIN, OPS_ADMIN
   */
  public static async resolveException(req: Request, res: Response) {
    const { id } = req.params;
    const { action, resolutionNote } = req.body; // action: 'PROCEED' | 'CANCEL'
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:resolve_exception:${id}:${action}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.json(existingReq.responseBody);

    const shipment = await ImportRequest.findById(id);
    if (!shipment) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });

    // M2 NOTE — DOCUMENTED FSM EXCEPTION: CANCELLED is only FSM-reachable from
    // DECLARED/RECEIVED_AT_ORIGIN. This is an admin exception-resolution escalation
    // for flagged shipments (the FSM validator would reject any move on a flagged
    // shipment), fully audited by the RESOLVE_IMPORT_EXCEPTION log below.
    if (action === 'CANCEL') {
      shipment.status = ImportStatus.CANCELLED;
    }
    
    shipment.isFlagged = false;
    shipment.exceptionType = undefined;
    await shipment.save();

    await AdminAuditLog.create({
      adminId: req.user?.userId,
      action: 'RESOLVE_IMPORT_EXCEPTION',
      targetId: shipment._id,
      targetModel: 'ImportRequest',
      details: `Action: ${action}. Note: ${resolutionNote}`,
      requestId: req.id
    });

    const responsePayload = { success: true, message: 'Shipment unfrozen.' };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }

  /**
   * adminForceState: Break-glass override for shipments.
   */
  /**
   * adminForceState: Now includes "Break-Glass" bypass
   */
  public static async adminForceState(req: Request, res: Response) {
    const { shipmentId } = req.params;
    const { newState, reason, bypassFSM, nextLocationId } = req.body;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:force_state:${shipmentId}:${newState}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.json(existingReq.responseBody);

    const shipment = await ImportRequest.findById(shipmentId);
    if (!shipment) return res.status(404).json({ error: 'NOT_FOUND' });

    // "Break-Glass" Logic
    // M2 NOTE: The standard path validates against IMPORT_FSM; the break-glass
    // bypass is an intentional, audited escalation (BREAK_GLASS_STATE_OVERRIDE
    // AdminAuditLog entry below) restricted to the FORCE_SHIPMENT_STATE capability.
    if (bypassFSM) {
      if (!nextLocationId) {
        return res.status(400).json({ error: 'LOCATION_REQUIRED_FOR_BYPASS' });
      }
      shipment.currentLocationId = nextLocationId;
    } else {
      // Standard FSM check
      if (!IMPORT_FSM[shipment.status]?.includes(newState)) {
        return res.status(400).json({ error: 'INVALID_TRANSITION' });
      }
    }

    shipment.status = newState;
    await shipment.save();

    await AdminAuditLog.create({
      adminId: req.user?.userId,
      action: bypassFSM ? 'BREAK_GLASS_STATE_OVERRIDE' : 'ADMIN_FORCE_STATE',
      targetId: shipment._id,
      targetModel: 'ImportRequest',
      details: `Forced to ${newState}. Reason: ${reason}`,
      requestId: req.id
    });

    const responsePayload = { success: true };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }
}