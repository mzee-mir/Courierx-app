import { Request, Response } from 'express';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { IMPORT_FSM, ManifestStatus, validateImportTransition } from '../config/stateMachine';
import { ShipmentLog } from '../models/ShipmentLog';
import mongoose, { Types } from 'mongoose';
import { ResolverService } from '../services/ResolverService';
import { ImportService } from '../services/ImportService';
import { User, UserRole } from '../models/User';
import { PricingService } from '../services/PartnerPricingService';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { Manifest } from '../models/Manifest';
import { PartnerOrganization } from '../models/PartnerOrganization';
import { SystemSettings } from '../models/SystemSettings';
import { log } from 'console';
import { PartnerRateCard } from '../models/PartnerRateCard';
import { PartnerLocation } from '../models/PartnerLocation';
import { socketService } from '..';
import { redactOrder } from '../utils/redact';
import { NotificationService } from '../services/notificationService';

/**
 * HELPER: The System Authority Map
 * Defines what a status means in human-operational terms.
 */
const getActionMeta = (status: string) => {
  const map: Record<string, { label: string; type: string }> = {
    [ImportStatus.DECLARED]: { label: 'START_INTAKE_SCAN', type: 'INTAKE' },
    [ImportStatus.RECEIVED_AT_ORIGIN]: { label: 'ASSIGN_TO_MANIFEST', type: 'MOVE' },
    [ImportStatus.ARRIVED_LOCAL]: { label: 'RECORD_ARRIVAL_WEIGHT', type: 'MOVE' },
    [ImportStatus.READY_FOR_LOCAL_HANDOFF]: { label: 'RELEASE_TO_COURIER', type: 'HANDOFF' }
  };
  return map[status] || { label: 'VIEW_DETAILS', type: 'NONE' };
};

export class ImportPartnerController {
  /**
   * GET ALLOWED ACTIONS: Used by the UI to show/hide buttons.
   * "UI is derived, not designed."
   */
  public static async getAllowedTransitions(req: Request, res: Response) {
    const { id } = req.params;
    const shipment = await ImportRequest.findById(id);
    if (!shipment) return res.status(404).json({ error: 'NOT_FOUND' });

    const allowed = IMPORT_FSM[shipment.status] || [];
    res.json({ success: true, currentStatus: shipment.status, allowed });
  }

  /**
   * POST /scan-intake
   * Optimized for Scenario A (Declared) and B (Surprise)
   */
  public static async scanIntake(req: Request, res: Response) {
    // 1. Destructure the NEW field from req.body
    const {
      trackingNumber,
      weight,
      binLocation,
      mode,
      locationId,
      dimensions,
      destinationBranchId // 👈 Capture this from the payload
    } = req.body;

    const partnerId = req.user?.partnerId;

    try {
      // 2. Lookup using Case-Insensitive Regex (Logistics Standard)
      const shipment = await ImportRequest.findOne({
        externalTrackingNumber: { $regex: `^${trackingNumber}$`, $options: 'i' }
      }).populate('userId');

      if (!shipment) {
        return res.status(200).json({ success: false, mode: 'QUICK_CREATE_REQUIRED' });
      }

      // Partner Authorization Scope (Task 0.4)
      const isAdmin = req.user?.roles?.includes(UserRole.SUPER_ADMIN);
      if (!isAdmin && shipment.partnerId?.toString() !== partnerId?.toString()) {
        return res.status(403).json({ error: 'UNAUTHORIZED_PARTNER_SCOPE' });
      }

      if (shipment.status !== 'DECLARED') {
        return res.status(400).json({ error: 'ALREADY_PROCESSED' });
      }

      // 3. Pricing Logic
      const pricing = await PricingService.calculateSplitPrice({
        partnerId: partnerId!.toString(),
        weight: Number(weight),
        mode: mode as 'AIR' | 'SEA',
        dimensions: mode === 'SEA' ? dimensions : undefined
      });

      const randomPackageId = Math.floor(100000 + Math.random() * 900000).toString();

      // 4. DATA ASSIGNMENT
      shipment.intake_weight = Number(weight);
      shipment.transportMode = mode;
      shipment.intakeMethod = 'SCAN';
      shipment.packageCode = randomPackageId;

      // 🚨 THE FIX: Explicitly assign the destination branch
      if (destinationBranchId) {
        shipment.destinationBranchId = new mongoose.Types.ObjectId(destinationBranchId);
      }

      shipment.pricingSnapshot = {
        totalCustomerPaid: pricing.totalCustomerPaid,
        partnerShare: pricing.partnerShare,
        systemShare: pricing.systemShare,
        baseRateAtIntake: pricing.appliedRate
      };

      shipment.status = ImportStatus.RECEIVED_AT_ORIGIN;
      shipment.binLocation = binLocation;
      shipment.currentLocationId = locationId;
      shipment.partnerId = partnerId as any;
      shipment.locationId = locationId;

      if (mode === 'SEA') {
        shipment.dimensions = dimensions;
        shipment.calculatedCBM = pricing.calculatedCBM;
      }

      // 5. Final Save
      await shipment.save();

      // 6. Response
      res.status(200).json({
        success: true,
        message: 'INTAKE_COMPLETE',
        cxCode: randomPackageId,
        customerPhone: (shipment.userId as any)?.phoneNumber || "N/A",
        price: pricing.totalCustomerPaid,
        calculatedCBM: pricing.calculatedCBM || 0
      });

      // Task 5.1: Notify customer (non-blocking, post-response)
      NotificationService.sendImportStatusNotification({
        userId: shipment.userId.toString(),
        importId: shipment._id.toString(),
        itemDescription: shipment.itemDescription,
        newStatus: ImportStatus.RECEIVED_AT_ORIGIN,
        extraDetail: `${weight}kg`
      }).catch(err => console.error('[Notification] scanIntake notify failed:', err.message));

    } catch (error: any) {
      console.error("INTAKE_ERROR:", error.message);
      res.status(400).json({ error: 'SCAN_FAILURE', message: error.message });
    }
  }

  public static async getTerminalPulse(req: Request, res: Response) {
    try {
      const { partnerId, assignedLocations } = req.user!;
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      // 1. Fetch counts in parallel for speed
      const [intakeToday, floorInventory, openManifests, flaggedItems] = await Promise.all([
        // Items scanned at this partner's locations today
        ImportRequest.countDocuments({
          partnerId,
          currentLocationId: { $in: assignedLocations },
          createdAt: { $gte: startOfToday }
        }),
        // Items currently sitting in the warehouse (not yet consolidated)
        ImportRequest.countDocuments({
          partnerId,
          currentLocationId: { $in: assignedLocations },
          status: { $in: ['RECEIVED_AT_ORIGIN', 'CONSOLIDATED'] }
        }),
        // Manifests in DRAFT or CONSOLIDATED status for this org
        Manifest.countDocuments({
          partnerId,
          status: { $in: ['DRAFT', 'CONSOLIDATED'] }
        }),
        // Shipments at this location with active exceptions
        ImportRequest.countDocuments({
          currentLocationId: { $in: assignedLocations },
          isFlagged: true
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          intakeToday,
          floorInventory,
          openManifests,
          flaggedItems
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'TERMINAL_PULSE_FAILED' });
    }
  }

  public static async getDashboardBriefing(req: Request, res: Response) {
    try {
      const { partnerId, assignedLocations } = req.user!;

      console.log('Generating dashboard briefing for partner:', { partnerId, assignedLocations });

      // 1. Organization Authority Check
      const org = await PartnerOrganization.findById(partnerId)
        .select('name status operatingCountries')
        .lean();

      // 2. Action Required (Unflagged & Physically Present)
      const actionRequiredRaw = await ImportRequest.find({
        partnerId,
        currentLocationId: { $in: assignedLocations },
        isFlagged: false,
        status: {
          $in: [
            ImportStatus.DECLARED,
            ImportStatus.RECEIVED_AT_ORIGIN,
            ImportStatus.ARRIVED_LOCAL,
            ImportStatus.READY_FOR_LOCAL_HANDOFF
          ]
        }
      })
        .limit(10)
        .select('externalTrackingNumber status itemDescription transportMode')
        .lean();

      const actionRequired = actionRequiredRaw.map(s => ({
        id: s._id,
        tracking: s.externalTrackingNumber,
        status: s.status,
        actionLabel: getActionMeta(s.status).label,
        actionType: getActionMeta(s.status).type
      }));

      // 3. Blocked Inventory (Physical custody but flagged/exception)
      const blocked = await ImportRequest.find({
        currentLocationId: { $in: assignedLocations },
        isFlagged: true
      })
        .limit(5)
        .select('externalTrackingNumber status exceptionType updatedAt')
        .lean();

      // 4. Quick Counts (Operational Snapshot)
      const [atLocations, inTransit, completed24h] = await Promise.all([
        ImportRequest.countDocuments({
          currentLocationId: { $in: assignedLocations },
          status: ImportStatus.RECEIVED_AT_ORIGIN
        }),
        ImportRequest.countDocuments({
          partnerId,
          status: ImportStatus.IN_TRANSIT
        }),
        ImportRequest.countDocuments({
          partnerId,
          status: ImportStatus.DELIVERED,
          updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        })
      ]);

      // 5. Audit Feed (Recent events for this partner)
      const activity = await ShipmentLog.find({
        importRequestId: { $in: await ImportRequest.find({ partnerId }).distinct('_id') }
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          org: {
            name: org?.name,
            status: org?.status || 'SUSPENDED',
            locationCount: assignedLocations.length
          },
          actionRequired,
          blocked,
          stats: { atLocations, inTransit, completed24h },
          activity
        }
      });
    } catch (error) {
      console.error('DASHBOARD_BRIEFING_CRASH:', error);
      res.status(500).json({ error: 'BRIEFING_LOAD_FAILED' });
    }
  }

  /**
   * getBlockedInventory: Forensic list of all items currently frozen.
   */
  public static async getBlockedInventory(req: Request, res: Response) {
    try {
      const { partnerId, assignedLocations } = req.user!;

      const blocked = await ImportRequest.find({
        partnerId,
        currentLocationId: { $in: assignedLocations },
        isFlagged: true
      })
        .select('externalTrackingNumber status exceptionType intake_weight arrival_weight updatedAt itemDescription packageCode')
        .sort({ updatedAt: -1 })
        .lean();

      res.status(200).json({ success: true, data: blocked });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_BLOCKED_FAILED' });
    }
  }

  /**
   * resolveShipmentException: Managerial override to unfreeze a shipment.
   */
  public static async resolveShipmentException(req: Request, res: Response) {
    const { id } = req.params;
    const { resolutionAction, notes } = req.body; // Action: 'RELEASE' | 'CANCEL' | 'RETURN'
    const user = req.user!;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const shipment = await ImportRequest.findById(id).session(session);
        if (!shipment) throw new Error('SHIPMENT_NOT_FOUND');

        // Partner Authorization Scope (Task 0.4)
        const isAdmin = user.roles?.includes(UserRole.SUPER_ADMIN);
        if (!isAdmin && shipment.partnerId?.toString() !== user.partnerId?.toString()) {
          throw new Error('UNAUTHORIZED_PARTNER_SCOPE');
        }

        const oldStatus = shipment.status;

        if (resolutionAction === 'RELEASE') {
          shipment.isFlagged = false;
          // Move to the next logical step since it was likely stuck at Arrival
          shipment.status = ImportStatus.READY_FOR_LOCAL_HANDOFF;

          shipment.statusHistory.push({
            status: ImportStatus.READY_FOR_LOCAL_HANDOFF,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(user.userId),
            changedByRole: 'MANAGER',
            notes: `EXCEPTION_RESOLVED [RELEASE]: ${notes}`
          });

          const { CustodyLog } = require('../models/CustodyLog');
          await CustodyLog.create([{
            importId: shipment._id,
            fromStatus: oldStatus,
            toStatus: ImportStatus.READY_FOR_LOCAL_HANDOFF,
            changedBy: user.userId,
            changedAt: new Date()
          }], { session });

        } else if (resolutionAction === 'CANCEL') {
          shipment.status = ImportStatus.EXCEPTION;
          shipment.isFlagged = true; // Keep flagged but move to terminal state

          shipment.statusHistory.push({
            status: ImportStatus.EXCEPTION,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(user.userId),
            changedByRole: 'MANAGER',
            notes: `EXCEPTION_RESOLVED [CANCEL]: ${notes}`
          });

          const { CustodyLog } = require('../models/CustodyLog');
          await CustodyLog.create([{
            importId: shipment._id,
            fromStatus: oldStatus,
            toStatus: ImportStatus.EXCEPTION,
            changedBy: user.userId,
            changedAt: new Date()
          }], { session });
        }

        await shipment.save({ session });

        await ShipmentLog.create([{
          importRequestId: shipment._id,
          actorId: user.userId,
          actorModel: 'User',
          oldStatus,
          newStatus: shipment.status,
          notes: `EXCEPTION_RESOLVED [${resolutionAction}]: ${notes}`,
          location: 'MANAGEMENT_OFFICE'
        }], { session });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
 * trackShipment: Deep-search through the supply chain.
 * Logic: Bypasses physical custody filters, but enforces PartnerOrg ownership.
 */
  public static async trackShipment(req: Request, res: Response) {
    try {
      const { trackingNumber } = req.params;
      const { partnerId } = req.user!;

      // 1. ANCHORED SEARCH: Strictly against external ID
      // Case-insensitive but starts-with (^) for performance
      const shipment = await ImportRequest.findOne({
        partnerId: new mongoose.Types.ObjectId(partnerId as string),
        externalTrackingNumber: { $regex: `^${trackingNumber}$`, $options: 'i' }
      })
        .select('id externalTrackingNumber status itemDescription')
        .lean();

      if (!shipment) {
        return res.status(404).json({
          error: 'REFERENCE_NOT_FOUND',
          message: 'No shipment matching this tracking ID found in your network.'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: shipment._id.toString(), // Clean ID for frontend navigation
          tracking: shipment.externalTrackingNumber,
          status: shipment.status
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'SEARCH_GATEWAY_FAILURE' });
    }
  }

  public static async getShipmentAuthority(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { partnerId, assignedLocations, roles } = req.user!;

      const shipment = await ImportRequest.findById(id)
        .populate('currentLocationId', 'name city country')
        .populate('userId', 'phoneNumber cxCode')
        .lean();

      if (!shipment) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });

      // Resolve Metadata & Node Name
      const metadata = {
        description: shipment.itemDescription,
        weight: Number(shipment.intake_weight) || 0,
        mode: shipment.transportMode,
        destination: shipment.dropoffLandmark,
        packageCode: shipment.packageCode || "N/A",
        customerPhone: (shipment.userId as any)?.phoneNumber || "N/A"
      };

      const VIRTUAL_ID = "507f1f77bcf86cd799439011";
      const isVirtual = shipment.currentLocationId?._id?.toString() === VIRTUAL_ID;
      const physicalControlName = isVirtual ? "VIRTUAL_TRANSIT_NODE" : (shipment.currentLocationId as any)?.name;

      const activity = await ShipmentLog.find({ importRequestId: id }).sort({ createdAt: -1 }).limit(10).lean();

      // ACTION RESOLVER
      const nextStates = IMPORT_FSM[shipment.status as ImportStatus] || [];
      const nextStatus = nextStates[0];
      let allowedActions: any[] = [];

      if (nextStatus) {
        const actionMap: Record<string, any> = {
          // 🚨 OPTION A: REMOVED CONSOLIDATE_ITEM from individual console
          [ImportStatus.IN_TRANSIT]: {
            code: 'MANIFEST_DEPART',
            label: 'Execute Dispatch',
            requires: ['photos'],
            nextStatus: ImportStatus.IN_TRANSIT
          },
          [ImportStatus.READY_FOR_LOCAL_HANDOFF]: {
            code: 'RECORD_ARRIVAL',
            label: 'Verify Arrival Weight',
            requires: ['arrivalWeight', 'photos'],
            nextStatus: ImportStatus.READY_FOR_LOCAL_HANDOFF
          },
          [ImportStatus.HANDED_OFF]: {
            code: 'LOCAL_RELEASE',
            label: 'Release to Local Courier',
            requires: [],
            nextStatus: ImportStatus.HANDED_OFF
          }
        };
        if (actionMap[nextStatus]) allowedActions = [actionMap[nextStatus]];
      }

      res.status(200).json({
        success: true,
        data: {
          shipment: redactOrder(shipment),
          metadata,
          physicalControlName,
          allowed: allowedActions, // Will be [] for RECEIVED_AT_ORIGIN
          activity,
          lockReason: shipment.status === 'RECEIVED_AT_ORIGIN' ? 'BATCHING_REQUIRED' : (shipment.isFlagged ? shipment.exceptionType : null)
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'AUTHORITY_CHECK_FAILED' });
    }
  }
  /**
   * getMyInventory: Scoped list of physical items at the user's locations.
   */

  public static async getMyInventory(req: Request, res: Response) {
    try {
      // 1. IDENTITY HYDRATION: Extract scoped data from the hardened middleware
      const { assignedLocations = [], partnerId } = req.user || {};
      const { search, status, transportMode, page = 1, limit = 20 } = req.query;

      // BLOCKER: If no partner context, refuse access
      if (!partnerId) {
        return res.status(403).json({ error: 'ORG_CONTEXT_MISSING' });
      }

      const skip = (Number(page) - 1) * Number(limit);

      // 2. CORE QUERY CONSTRUCTION
      // Security Rule: Only show items where this user has physical custody
      const query: any = {
        partnerId: new mongoose.Types.ObjectId(partnerId as string),
        currentLocationId: {
          $in: assignedLocations.map(id => new mongoose.Types.ObjectId(id))
        }
      };

      // Apply Filters
      if (search) {
        // Anchored regex (^) prevents scanning entire DB, improves performance
        query.externalTrackingNumber = { $regex: `^${search}`, $options: 'i' };
      }
      if (status) {
        query.status = status;
      }
      if (transportMode) {
        query.transportMode = transportMode;
      }

      // 3. EXECUTION: Parallel count and find for speed
      const [shipments, total] = await Promise.all([
        ImportRequest.find(query)
          .populate('currentLocationId', 'name city country')
          .sort({ updatedAt: -1 }) // Show most recent movement first
          .skip(skip)
          .limit(Number(limit))
          .lean(), // lean() improves performance for read-only views
        ImportRequest.countDocuments(query)
      ]);

      // 4. ALIGNMENT: Map to Redacted Format & include Pagination object
      // This specifically fixes the "Cannot read properties of undefined (reading 'total')" error
      res.status(200).json({
        success: true,
        count: shipments.length,
        data: shipments.map(s => ({
          id: s._id, // 👈 Change _id to id for the frontend Link logic
          tracking: s.externalTrackingNumber,
          status: s.status,
          description: s.itemDescription,
          weight: s.intake_weight,
          isFlagged: s.isFlagged,
          exceptionType: s.exceptionType,
          transportMode: s.transportMode,
          locationName: (s.currentLocationId as any)?.name || 'VIRTUAL_TRANSIT',
          updatedAt: s.updatedAt,
          version: s.__v // Required for Module D (Optimistic Locking)
        })),
        pagination: { // 👈 REQUIRED by InventoryFloor.tsx:150
          total,
          pages: Math.ceil(total / Number(limit)),
          currentPage: Number(page),
          limit: Number(limit)
        }
      });

    } catch (error: any) {
      console.error(`[INVENTORY_FETCH_ERROR][${req.id}]:`, error.message);
      res.status(500).json({
        error: 'INVENTORY_FETCH_FAILED',
        message: 'Could not synchronize physical inventory list.'
      });
    }
  }


  public static async getHandoffQueue(req: Request, res: Response) {
    try {
      const { assignedLocations, partnerId } = req.user!;

      const queue = await ImportRequest.find({
        partnerId,
        currentLocationId: { $in: assignedLocations },
        status: ImportStatus.READY_FOR_LOCAL_HANDOFF,
        isFlagged: false
      })
        .select('externalTrackingNumber itemDescription intake_weight arrival_weight dropoffLandmark transportMode')
        .sort({ updatedAt: 1 }) // Oldest arrivals first
        .lean();

      res.status(200).json({ success: true, data: queue });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_QUEUE_FAILED' });
    }
  }

  /**
   * ADVANCE SHIPMENT: Moves the box to the next node.
   */
  // controllers/ImportPartnerController.ts

  public static async transitionStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { actionCode, weight, evidenceIds, notes, manifestId } = req.body;
    const user = req.user!;
    const shipment = (req as any).shipment; // Injected by enforceCustody middleware

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Map Operational Action to DB Status
        const actionToStatus: Record<string, ImportStatus> = {
          'MANIFEST_DEPART': ImportStatus.IN_TRANSIT,
          'RECORD_ARRIVAL': ImportStatus.READY_FOR_LOCAL_HANDOFF,
          'LOCAL_RELEASE': ImportStatus.HANDED_OFF
        };

        const nextStatus = actionToStatus[actionCode];
        if (!nextStatus) throw new Error('INVALID_ACTION_CODE');

        // 2. FSM GATEKEEPER: Check for Exception Locks and Logical Jumps
        // This closes the "FSM Bypass" vulnerability identified in the audit.
        validateImportTransition(shipment, nextStatus, user);

        const oldStatus = shipment.status;
        const oldLocation = shipment.currentLocationId;

        // 3. ATOMIC HANDOVER: coupled State/Location logic
        if (actionCode === 'RECORD_ARRIVAL') {
          if (!weight) throw new Error('WEIGHT_REQUIRED_FOR_ARRIVAL');

          // COUPLED UPDATE: Status -> READY, Location -> Destination Hub
          const manifest = await Manifest.findById(shipment.manifestId).session(session);
          if (!manifest) throw new Error('MANIFEST_LINK_ERROR');

          shipment.arrival_weight = weight;
          shipment.currentLocationId = manifest.destinationHub; // Atomic handover to Somalia Node

          // Auto-Flag for weight discrepancies (Audit requirement)
          const delta = Math.abs(shipment.intake_weight - weight);
          if (delta > 0.5) {
            shipment.isFlagged = true;
            shipment.exceptionType = 'WEIGHT_DISCREPANCY';
          }
        }

        if (actionCode === 'MANIFEST_DEPART') {
          // Virtual Node handover for in-transit items
          shipment.currentLocationId = new mongoose.Types.ObjectId("507f1f77bcf86cd799439011");
        }

        // 4. PERSISTENCE
        shipment.status = nextStatus;
        if (evidenceIds?.length > 0) {
          shipment.hasPhotos = true;
          evidenceIds.forEach((url: string) => shipment.intakePhotos.push({ url, uploadedAt: new Date() }));
        }

        await shipment.save({ session });

        // 5. IMMUTABLE LOGGING
        await ShipmentLog.create([{
          importRequestId: shipment._id,
          actorId: user.userId,
          actorModel: 'User',
          oldStatus,
          newStatus: shipment.status,
          location: shipment.currentLocationId.toString(),
          notes: notes || `Action [${actionCode}] verified at ${shipment.currentLocationId}`
        }], { session });
      });

      res.status(200).json({
        success: true,
        status: shipment.status,
        currentLocation: shipment.currentLocationId
      });

      // Task 5.1: Fire push notification AFTER transaction commits (non-blocking)
      // Build extra detail for weight dispute notifications
      let extraDetail: string | undefined;
      if (shipment.status === ImportStatus.WEIGHT_DISPUTE) {
        extraDetail = `intake ${shipment.intake_weight}kg → arrival ${shipment.arrival_weight}kg`;
      }
      NotificationService.sendImportStatusNotification({
        userId: shipment.userId.toString(),
        importId: shipment._id.toString(),
        itemDescription: shipment.itemDescription,
        newStatus: shipment.status,
        extraDetail
      }).catch(err => console.error('[Notification] Failed to send import status notification:', err.message));

    } catch (error: any) {
      res.status(400).json({ error: 'TRANSITION_FAILED', message: error.message });
    } finally {
      session.endSession();
    }
  }

  public static async resolveAndIntake(req: Request, res: Response) {
    const { cxCode, externalTrackingNumber, itemDescription, originCountry, shippingMode, isFragile, locationId, intakeWeight } = req.body;
    const partnerId = req.user?.partnerId;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // 1. Authority Check: Does this staff member belong to this location?
        const isAuthorizedLocation = req.user?.assignedLocations?.some(
          loc => loc.toString() === locationId
        );
        if (!isAuthorizedLocation) throw new Error('LOCATION_ACCESS_DENIED');

        // 2. Resolve Customer (The Snapshot)
        // This pulls name, phone, and landmark from the User/Landmark collections
        const resolution = await ResolverService.resolveAddress(cxCode);

        // 2. CALCULATE PRICE (New Logic)
        const pricing = await PricingService.calculateSplitPrice({
          partnerId: req.user!.partnerId!,
          weight: intakeWeight,
          mode: shippingMode,
        });

        // 3. Create the Immutable Shipment Record
        const shipment = await ImportRequest.create([{
          userId: resolution.userId,
          partnerId,
          locationId,
          currentLocationId: locationId,
          externalTrackingNumber,
          itemDescription,
          originCountry,
          pricingSnapshot: pricing,
          intake_weight: intakeWeight, // 👈 Locked via { immutable: true } in Schema
          resolverSnapshot: resolution.snapshot,
          resolvedAt: resolution.resolvedAt,
          status: ImportStatus.RECEIVED_AT_ORIGIN, // Starts at Received
          chinaAgentId: partnerId // Assign current org as China Agent
        }], { session });

        // 4. Log the Event
        await ShipmentLog.create([{
          importRequestId: shipment[0]._id,
          actorId: req.user?.userId,
          actorModel: 'User',
          newStatus: ImportStatus.RECEIVED_AT_ORIGIN,
          location: `Intake at ${locationId}`,
          notes: `Shipment resolved for ${cxCode} and intake weight recorded.`
        }], { session });

        res.status(201).json({
          success: true,
          shipmentId: shipment[0]._id,
          resolvedFor: resolution.snapshot.name
        });
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  public static async getOrgAuditTrail(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;
      const { search, start, end } = req.query; // 👈 Capture filters

      let shipmentIds: any[] = [];

      // 1. If searching for a specific Tracking ID
      if (search) {
        shipmentIds = await ImportRequest.find({
          partnerId,
          externalTrackingNumber: { $regex: search, $options: 'i' }
        }).distinct('_id');
      } else {
        shipmentIds = await ImportRequest.find({ partnerId }).distinct('_id');
      }

      // 2. Build the Log Query
      const logQuery: any = {
        importRequestId: { $in: shipmentIds }
      };

      // 3. Date Range Logic
      if (start || end) {
        logQuery.createdAt = {};
        if (start) logQuery.createdAt.$gte = new Date(start as string);
        if (end) {
          const endDate = new Date(end as string);
          endDate.setHours(23, 59, 59, 999); // Include the whole end day
          logQuery.createdAt.$lte = endDate;
        }
      }

      const logs = await ShipmentLog.find(logQuery)
        .sort({ createdAt: -1 })
        .limit(100)
        .populate('importRequestId', 'externalTrackingNumber')
        .lean();

      res.status(200).json({ success: true, logs });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_AUDIT_TRAIL_FAILED' });
    }
  }

  public static async resolveException(req: Request, res: Response) {
    const { id } = req.params;
    const { action, note } = req.body;
    const user = req.user!;

    const shipment = await ImportRequest.findById(id);
    if (!shipment) return res.status(404).json({ error: 'NOT_FOUND' });

    // Partner Authorization Scope (Task 0.4)
    const isAdmin = user.roles?.includes(UserRole.SUPER_ADMIN);
    if (!isAdmin && shipment.partnerId?.toString() !== user.partnerId?.toString()) {
      return res.status(403).json({ error: 'UNAUTHORIZED_PARTNER_SCOPE' });
    }

    shipment.isFlagged = false;
    if (action === 'CANCEL') shipment.status = 'CANCELLED' as any;
    await shipment.save();

    res.json({ success: true, message: 'RESOLVED' });
  }

  /**
   * verifyUnsealItem: Atomic verification of a package at the destination Port/Hub.
   */
  public static async verifyUnsealItem(req: Request, res: Response) {
    const { id: manifestId } = req.params;
    const { trackingNumber, arrivalWeight, notes, photos } = req.body;
    const user = req.user!;
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const manifest = await Manifest.findById(manifestId).populate('originHub destinationHub').session(session);
        const shipment = await ImportRequest.findOne({ externalTrackingNumber: trackingNumber, manifestId }).session(session);
        if (!shipment || !manifest) throw new Error('DATA_LINK_ERROR');

        const partner = await PartnerOrganization.findById(shipment.partnerId).session(session);
        const weightDelta = Math.abs(Number(shipment.intake_weight) - Number(arrivalWeight));

        // 1. Photo Check for Discrepancy
        if ((weightDelta > 0.5 || notes) && (!photos || photos.length === 0)) {
          throw new Error('EVIDENCE_REQUIRED: Discrepancy detected. Photo mandatory.');
        }

        // 2. Data Persistence
        shipment.arrival_weight = Number(arrivalWeight);
        shipment.currentLocationId = manifest.destinationHub as any;

        // 3. OPTION B: Domestic Surcharge Logic
        const isGateway = (manifest.destinationHub as any).city.toUpperCase() === "MOGADISHU";
        const needsOnwardTransit = shipment.destinationBranchId &&
          shipment.destinationBranchId.toString() !== manifest.destinationHub.toString();

        const oldStatus = shipment.status;
        let newStatus = ImportStatus.READY_FOR_LOCAL_HANDOFF;

        if (needsOnwardTransit && isGateway) {
          const rate = partner?.domesticConfig?.ratePerKg || 1.0;
          const surcharge = Number(arrivalWeight) * rate;

          shipment.pricingSnapshot.totalCustomerPaid += surcharge;
          shipment.pricingSnapshot.partnerShare += surcharge;
          shipment.domesticSurcharge = surcharge;
          newStatus = ImportStatus.ARRIVED_LOCAL; // Stays here for domestic manifesting
        }

        shipment.status = newStatus;

        // 4. Exception Handling
        if (weightDelta > 0.5) {
          shipment.isFlagged = true;
          shipment.exceptionType = 'WEIGHT_DISCREPANCY' as any;
        }

        // 5. Photos and Save
        if (photos?.length > 0) {
          shipment.hasPhotos = true;
          photos.forEach((url: string) => shipment.intakePhotos.push({ url, uploadedAt: new Date() }));
        }

        shipment.statusHistory.push({
          status: newStatus,
          changedAt: new Date(),
          changedBy: new Types.ObjectId(user.userId),
          changedByRole: 'STAFF',
          notes: notes || `Arrival verified at ${isGateway ? 'Gateway' : 'Branch'}.`
        });

        await shipment.save({ session });

        const { CustodyLog } = require('../models/CustodyLog');
        await CustodyLog.create([{
          importId: shipment._id,
          fromStatus: oldStatus,
          toStatus: newStatus,
          changedBy: user.userId,
          changedAt: new Date()
        }], { session });

        await ShipmentLog.create([{
          importRequestId: shipment._id,
          actorId: user.userId,
          actorModel: 'User',
          newStatus: shipment.status,
          notes: notes || `Arrival verified at ${isGateway ? 'Gateway' : 'Branch'}.`,
          location: (manifest.destinationHub as any).name
        }], { session });
      });

      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
   * finalizeUnsealing: Closes the manifest and logs the closing statement.
   */
  public static async finalizeUnsealing(req: Request, res: Response) {
    const { id } = req.params;
    const { closingDescription } = req.body;

    const manifest = await Manifest.findById(id);
    if (!manifest) return res.status(404).json({ error: 'MANIFEST_NOT_FOUND' });

    manifest.status = ManifestStatus.DISMANTLED;
    await manifest.save();

    await AdminAuditLog.create({
      adminId: req.user?.userId,
      action: 'MANIFEST_DISMANTLED',
      targetId: manifest._id,
      targetModel: 'Manifest',
      details: `Unsealing completed. Closing Note: ${closingDescription}`,
      requestId: req.id
    });

    res.json({ success: true });
  }

  /**
   * correctWeight: Allows Owner to fix floor staff typos.
   */
  public static async correctWeight(req: Request, res: Response) {
    const { id } = req.params;
    const { newWeight, reason } = req.body;
    const partnerId = req.user?.partnerId;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const shipment = await ImportRequest.findById(id).session(session);
        if (!shipment || shipment.partnerId?.toString() !== partnerId?.toString()) {
          throw new Error('SHIPMENT_NOT_FOUND_OR_UNAUTHORIZED');
        }

        const oldWeight = shipment.intake_weight;

        // 1. Recalculate Pricing Snapshot with New Weight
        const newPricing = await PricingService.calculateSplitPrice({
          partnerId: partnerId!.toString(),
          weight: newWeight,
          mode: shipment.transportMode as 'AIR' | 'SEA'
        });

        // 2. Update Shipment (Bypassing immutability via direct update)
        await ImportRequest.updateOne(
          { _id: id },
          {
            $set: {
              intake_weight: newWeight,
              pricingSnapshot: newPricing
            }
          },
          { session }
        );

        // 3. Log Correction
        await ShipmentLog.create([{
          importRequestId: id,
          actorId: req.user?.userId,
          actorModel: 'User',
          oldStatus: shipment.status,
          newStatus: shipment.status,
          notes: `WEIGHT_CORRECTED: ${oldWeight}kg -> ${newWeight}kg. Reason: ${reason}`,
          location: 'OFFICE_CORRECTION'
        }], { session });
      });

      res.json({ success: true, message: 'Weight corrected and price recalculated.' });
    } finally {
      session.endSession();
    }
  }

  /**
 * quickIntake: Handles "Surprise Arrivals" by linking a tracking number 
 * to a phone number found on the physical box label.
 */
  // server/src/controllers/ImportPartnerController.ts

  public static async quickIntake(req: Request, res: Response) {
    const { phoneNumber, trackingNumber, weight, itemDescription, mode, locationId, binLocation } = req.body;
    const partnerId = req.user?.partnerId;
    const session = await mongoose.startSession();

    // 1. Define the Bakara Market Fallback Constants
    const FALLBACK_COORDS = [45.3182, 2.0469]; // [lng, lat]
    const FALLBACK_LABEL = "Bakara Market (General Collection)";

    try {
      await session.withTransaction(async () => {
        // 2. Find the User
        const user = await User.findOne({ phoneNumber });
        if (!user) throw new Error('USER_NOT_FOUND: Customer must register with CourierX first.');

        // 3. Look for Default Landmark
        const Landmark = mongoose.model('Landmark');
        const userDefault = await Landmark.findOne({ userId: user._id, isDefault: true });

        // 🚨 THE FIX: Remove the 'if (!defaultLandmark) throw error' block
        // And replace it with this dynamic resolution:
        const finalLandmark = userDefault ? userDefault.label : FALLBACK_LABEL;
        const finalCoords = userDefault ? userDefault.location.coordinates : FALLBACK_COORDS;

        // 4. Calculate Price
        const pricing = await PricingService.calculateSplitPrice({
          partnerId: partnerId!.toString(),
          weight: Number(weight),
          mode: mode as 'AIR' | 'SEA'
        });

        const randomPackageId = Math.floor(100000 + Math.random() * 900000).toString();

        // 5. Create the shipment using the resolved address (Default or Fallback)
        const [shipment] = await ImportRequest.create([{
          userId: user._id,
          partnerId,
          locationId,
          currentLocationId: locationId,
          externalTrackingNumber: trackingNumber.toUpperCase(),
          packageCode: randomPackageId,
          itemDescription: itemDescription || "General Parcel",
          originCountry: "CN",

          // Use the resolved variables here 👇
          dropoffLandmark: finalLandmark,
          dropoffLocation: {
            type: 'Point',
            coordinates: finalCoords
          },

          transportMode: mode,
          intake_weight: Number(weight),
          binLocation: binLocation || "QUICK_INTAKE",
          pricingSnapshot: {
            totalCustomerPaid: pricing.totalCustomerPaid,
            partnerShare: pricing.partnerShare,
            systemShare: pricing.systemShare,
            baseRateAtIntake: pricing.appliedRate
          },
          status: ImportStatus.RECEIVED_AT_ORIGIN,
          intakeMethod: 'SCAN'
        }], { session });

        res.status(201).json({
          success: true,
          resolvedFor: user.displayName,
          cxCode: randomPackageId,
          customerPhone: user.phoneNumber,
          note: userDefault ? "Using customer home address" : "Fallback to Bakara Market applied"
        });
      });
    } catch (error: any) {
      console.error("QUICK_INTAKE_ERROR:", error.message);
      res.status(400).json({ error: 'REGISTRATION_FAILED', message: error.message });
    } finally {
      session.endSession();
    }
  }

  public static async processHandoff(req: Request, res: Response) {
    const { id } = req.params; // Shipment ID
    const actorId = req.user?.userId;

    try {
      // Note: 'enforceCustody' middleware should be applied to this route
      // to ensure only the Somalia Clearing Agent can trigger handoff.
      const result = await ImportService.initiateLocalHandoff(id, actorId!);

      res.status(200).json({
        success: true,
        message: 'HANDOFF_COMPLETE',
        localOrderId: result.localOrderId
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * updatePartnerRates: Creates a new Versioned Rate Card.
   * Enforces the Highlander Rule (Only one active card at a time).
   */
  /**
 * updatePartnerSettings: Allows Owner to set rates AND operational targets.
 */
  public static async updatePartnerSettings(req: Request, res: Response) {
    const { airRate, seaRate, dailyIntakeTarget, reason } = req.body;
    const partnerId = req.user?.partnerId;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. RATE VALIDATION (Ceiling check)
        const ceiling = await SystemSettings.findOne({ key: 'PRICE_CEILING_PER_KG', isActive: true });
        const maxAllowed = ceiling?.value || 15.00;

        if (airRate > maxAllowed || seaRate > maxAllowed) {
          throw new Error(`CEILING_VIOLATION: Max allowed rate is $${maxAllowed}`);
        }

        // 2. UPDATE ORGANIZATION (Non-contractual settings)
        await PartnerOrganization.findByIdAndUpdate(partnerId, {
          requestedAirRate: airRate,
          requestedSeaRate: seaRate,
          dailyIntakeTarget: dailyIntakeTarget || 100 // 👈 THE FIX: Persist the target
        }, { session });

        // 3. VERSIONED RATE CARD (Contractual history)
        await PartnerRateCard.updateMany(
          { partnerId, isActive: true },
          { $set: { isActive: false } },
          { session }
        );

        const [newCard] = await PartnerRateCard.create([{
          partnerId,
          airRate,
          seaRate,
          isActive: true,
          effectiveDate: new Date(),
          platformCommissionPercent: 15
        }], { session });

        // 4. AUDIT LOG
        await AdminAuditLog.create([{
          adminId: req.user?.userId,
          action: 'PARTNER_SETTINGS_UPDATE',
          targetId: partnerId,
          targetModel: 'PartnerOrganization',
          details: `Rates: A:${airRate}/S:${seaRate} | Target: ${dailyIntakeTarget}. Reason: ${reason}`,
          requestId: req.id
        }], { session });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
   * getActiveRateCard: Tells the UI what the current contract is.
   */
  public static async getActiveRateCard(req: Request, res: Response) {
    const partnerId = req.user?.partnerId;
    const card = await PartnerRateCard.findOne({ partnerId, isActive: true }).lean();

    // Fetch global ceiling so UI can prevent invalid entries
    const ceiling = await SystemSettings.findOne({ key: 'PRICE_CEILING_PER_KG', isActive: true });

    res.json({
      success: true,
      data: {
        card,
        ceiling: ceiling?.value || 15.00,
        systemAddOn: 0.50 // Hardcoded for MVP
      }
    });
  }

  /**
   * getOrgLocations: Returns all physical nodes belonging to the partner.
   */
  public static async getOrgLocations(req: Request, res: Response) {
    try {
      const partnerId = req.user?.partnerId;
      if (!partnerId) return res.status(403).json({ error: 'ORG_CONTEXT_MISSING' });

      const locations = await PartnerLocation.find({ partnerId }).lean();

      res.status(200).json({
        success: true,
        locations: locations.map(l => ({
          id: l._id,
          name: l.name,
          type: l.type,
          city: l.city,
          country: l.country
        }))
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_LOCATIONS_FAILED' });
    }
  }
  public static async createLocation(req: Request, res: Response) {
    try {
      const partnerId = req.user?.partnerId;
      const { name, type, country, city, address } = req.body;

      const location = await PartnerLocation.create({
        partnerId,
        name,
        type,
        country,
        city,
        address
      });
      res.status(201).json({ success: true, location });
    } catch (error: any) {
      res.status(400).json({ error: 'CREATE_LOCATION_FAILED', message: error.message });
    }
  }

  public static async updateDomesticRate(req: Request, res: Response) {
    try {
      const partnerId = req.user?.partnerId;
      const { ratePerKg } = req.body;

      await PartnerOrganization.findByIdAndUpdate(partnerId, {
        "domesticConfig.ratePerKg": ratePerKg
      });
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: 'UPDATE_DOMESTIC_RATE_FAILED', message: error.message });
    }
  }

  public static async updateLocation(req: Request, res: Response) {
    try {
      const partnerId = req.user?.partnerId;
      const { id } = req.params;
      const updates = req.body;

      const location = await PartnerLocation.findOneAndUpdate(
        { _id: id, partnerId },
        { $set: updates },
        { new: true }
      );
      if (!location) return res.status(404).json({ error: 'LOCATION_NOT_FOUND' });
      res.status(200).json({ success: true, location });
    } catch (error: any) {
      res.status(400).json({ error: 'UPDATE_LOCATION_FAILED', message: error.message });
    }
  }

  /**
 * updatePublicProfile: Allows owner to set their alibaba address and marketing info.
 */
  public static async updatePublicProfile(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;
      const updateData = req.body;

      const updated = await PartnerOrganization.findByIdAndUpdate(
        partnerId,
        { $set: { publicProfile: updateData } },
        { new: true }
      );

      res.json({ success: true, data: updated?.publicProfile });
    } catch (error) {
      res.status(400).json({ error: 'UPDATE_PROFILE_FAILED' });
    }
  }

  /**
   * getPartnerDetailsForCustomer: Public API for the Customer App
   */
  public static async getPublicDetails(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const partner = await PartnerOrganization.findById(id)
        .select('name status publicProfile ratingStats operatingCountries availableModes')
        .lean();

      if (!partner) return res.status(404).json({ error: 'NOT_FOUND' });

      res.json({ success: true, data: partner });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_PARTNER_FAILED' });
    }
  }

  /**
 * getSelfPublicProfile: Fetches the profile for the currently logged-in partner
 */
  public static async getSelfPublicProfile(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;

      // 1. Fetch both the Org and the Locations in parallel
      const [partner, locations] = await Promise.all([
        PartnerOrganization.findById(partnerId).lean(),
        PartnerLocation.find({ partnerId }).lean()
      ]);

      if (!partner) return res.status(404).json({ error: 'ORG_NOT_FOUND' });

      // 2. Logic: If China Address is empty, try to auto-format it from the CN Node
      let autoChinaAddress = partner.publicProfile?.chinaAddress;
      if (!autoChinaAddress) {
        const cnNode = locations.find(l => l.country === 'CN');
        if (cnNode) {
          autoChinaAddress = `${cnNode.address}, ${cnNode.city}, China. Tel: ${partner.publicProfile?.contactPhone || ''}`;
        }
      }

      // 3. Format Somali Collection Points for the UI
      const collectionPoints = locations
        .filter(l => l.country === 'SO')
        .map(l => ({
          city: l.city,
          name: l.name,
          address: l.address
        }));

      res.json({
        success: true,
        data: {
          ...partner.publicProfile,
          chinaAddress: autoChinaAddress || '',
          collectionPoints // 👈 Sending the list of Somali branches
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_PROFILE_FAILED' });
    }
  }

  public static async deleteLocation(req: Request, res: Response) {
    try {
      const partnerId = req.user?.partnerId;
      const { id } = req.params;

      const location = await PartnerLocation.findOneAndDelete({ _id: id, partnerId });
      if (!location) return res.status(404).json({ error: 'LOCATION_NOT_FOUND' });
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: 'DELETE_LOCATION_FAILED', message: error.message });
    }
  }

}