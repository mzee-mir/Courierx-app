import { Request, Response } from 'express';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { ShipmentLog } from '../models/ShipmentLog';
import { Order } from '../models/Order';
import { PartnerOrganization } from '../models/PartnerOrganization';
import mongoose, { Types } from 'mongoose';

// Active statuses (in transit, not resolved)
const ACTIVE_STATUSES = [
  ImportStatus.DECLARED,
  ImportStatus.RECEIVED_AT_ORIGIN,
  ImportStatus.CONSOLIDATED,
  ImportStatus.IN_TRANSIT,
  ImportStatus.ARRIVED_LOCAL,
  ImportStatus.READY_FOR_LOCAL_HANDOFF,
  ImportStatus.HANDED_OFF,
  ImportStatus.WEIGHT_DISPUTE,
  ImportStatus.CUSTOMS_HOLD,
  ImportStatus.PENDING_CUSTOMER_ACTION,
];

const HISTORY_STATUSES = [
  ImportStatus.DELIVERED,
  ImportStatus.CANCELLED,
  ImportStatus.EXPIRED,
  ImportStatus.LOST,
  ImportStatus.RETURN_TO_SENDER,
];

export class ImportController {
  /**
   * declare: Customer notifies the system of an incoming package (e.g. from Alibaba)
   */
  public static async declare(req: Request, res: Response) {
    try {
      const {
        externalTrackingNumber,
        itemDescription,
        originCountry,
        partnerId,
        transportMode,
        preferredLocalVehicle,
        dropoffLandmark,
        dropoffLocation,
        estimatedWeightKg,
        customsDeclaration
      } = req.body;

      const userId = req.user?.userId;

      // Task 2.3: Proper duplicate detection — scoped to this user with 409
      const existing = await ImportRequest.findOne({ userId, externalTrackingNumber });
      if (existing) {
        return res.status(409).json({
          error: 'DUPLICATE_TRACKING_NUMBER',
          existingImportId: existing._id
        });
      }

      if (partnerId) {
        const partner = await PartnerOrganization.findById(partnerId);
        if (!partner) return res.status(404).json({ error: 'PARTNER_NOT_FOUND' });

        const isModeSupported = transportMode === 'AIR' ? partner.availableModes?.air : partner.availableModes?.sea;
        if (!isModeSupported) {
          return res.status(400).json({
            error: 'MODE_NOT_SUPPORTED',
            message: `${partner.name} does not support ${transportMode} freight.`
          });
        }
      }

      // Create initial record in DECLARED state.
      const request = new ImportRequest({
        userId,
        partnerId: partnerId || undefined,
        externalTrackingNumber,
        itemDescription,
        originCountry,
        transportMode,
        preferredLocalVehicle,
        dropoffLandmark,
        dropoffLocation,
        intake_weight: estimatedWeightKg || undefined,
        customsDeclaration: customsDeclaration || undefined,
        status: ImportStatus.DECLARED,
      });

      request.statusHistory.push({
        status: ImportStatus.DECLARED,
        changedAt: new Date(),
        changedBy: new Types.ObjectId(userId),
        changedByRole: 'CUSTOMER',
        notes: 'Initial declaration by customer'
      });

      await request.save();

      const { CustodyLog } = require('../models/CustodyLog');
      await CustodyLog.create({
        importId: request._id,
        fromStatus: 'NONE',
        toStatus: ImportStatus.DECLARED,
        changedBy: userId,
        changedAt: new Date()
      });

      res.status(201).json({ success: true, request });
    } catch (error) {
      res.status(500).json({ error: 'DECLARATION_FAILED' });
    }
  }

  /**
   * Task 2.1: GET /cargo/:importId — Single Record Endpoint.
   * Replaces the client-side "fetch all, find one" anti-pattern.
   * Must be applied behind importOwnershipGuard middleware.
   */
  public static async getOne(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // importOwnershipGuard attaches the lean document; reuse it or do a richer populate
      const shipment = await ImportRequest.findById(id)
        .populate('partnerId', 'name publicProfile')
        .populate('currentLocationId', 'name city country')
        .populate('localOrderId', 'status driverName');

      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      res.status(200).json({ success: true, import: shipment });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_FAILED' });
    }
  }

  /**
   * Task 2.2: Paginated GET /cargo/my-imports with summary counts + cursor pagination.
   * Query params: ?status=active|history&cursor=<base64>&limit=20
   */
  public static async getMyImports(req: Request, res: Response) {
    try {
      const userId = req.user?.userId;
      const { status = 'active', cursor, limit = '20' } = req.query;
      const pageLimit = Math.min(parseInt(limit as string, 10) || 20, 50);

      const statusFilter = status === 'history'
        ? { $in: HISTORY_STATUSES }
        : { $in: ACTIVE_STATUSES };

      // Cursor-based pagination (keyset on _id for consistent ordering)
      const cursorFilter: any = {};
      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor as string, 'base64').toString('utf8'));
          cursorFilter._id = { $lt: new mongoose.Types.ObjectId(decoded._id) };
        } catch { /* invalid cursor — ignore and return first page */ }
      }

      const [imports, activeCount, historyCount] = await Promise.all([
        ImportRequest.find({ userId, status: statusFilter, ...cursorFilter })
          .populate('partnerId', 'name')
          .populate('currentLocationId', 'name city country')
          .sort({ _id: -1 })
          .limit(pageLimit + 1) // fetch one extra to detect hasMore
          .lean(),
        ImportRequest.countDocuments({ userId, status: { $in: ACTIVE_STATUSES } }),
        ImportRequest.countDocuments({ userId, status: { $in: HISTORY_STATUSES } }),
      ]);

      const hasMore = imports.length > pageLimit;
      if (hasMore) imports.pop();

      let nextCursor: string | null = null;
      if (hasMore && imports.length > 0) {
        const lastItem = imports[imports.length - 1];
        nextCursor = Buffer.from(JSON.stringify({ _id: lastItem._id })).toString('base64');
      }

      res.status(200).json({
        success: true,
        imports,
        summary: { active: activeCount, history: historyCount },
        cursor: nextCursor,
        hasMore
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_IMPORTS_FAILED' });
    }
  }

  /**
   * getUnifiedTimeline: The "Master View" for the customer app.
   * Merges Cargo Logs + Local Delivery status into one chronological stepper.
   */
  public static async getUnifiedTimeline(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const shipment = await ImportRequest.findOne({ _id: id, userId })
        .populate('currentLocationId', 'name city country');

      if (!shipment) return res.status(404).json({ error: 'SHIPMENT_NOT_FOUND' });

      const cargoLogs = await ShipmentLog.find({ importRequestId: id })
        .sort({ createdAt: 1 })
        .lean();

      const timeline: any[] = cargoLogs.map(log => ({
        status: log.newStatus,
        location: log.location || 'Logistics Hub',
        timestamp: log.createdAt,
        notes: log.notes,
        isLocalPhase: false,
        isException: shipment.isFlagged && log.newStatus === shipment.status
      }));

      if (shipment.localOrderId) {
        const localOrder = await Order.findById(shipment.localOrderId);
        if (localOrder) {
          const localEvents: any[] = [];

          localEvents.push({
            status: 'LOCAL_COURIER_ASSIGNED',
            location: 'CourierX Somalia Terminal',
            timestamp: localOrder.createdAt,
            isLocalPhase: true
          });

          if (['PICKED_UP', 'ARRIVED_AT_DROPOFF', 'DELIVERED'].includes(localOrder.status)) {
            localEvents.push({
              status: 'OUT_FOR_DELIVERY',
              location: 'En Route to Destination',
              timestamp: localOrder.updatedAt,
              isLocalPhase: true
            });
          }

          if (localOrder.status === 'DELIVERED') {
            localEvents.push({
              status: 'DELIVERED',
              location: shipment.resolverSnapshot?.deliveryLandmark || 'Final Destination',
              timestamp: localOrder.updatedAt,
              isLocalPhase: true
            });
          }

          timeline.push(...localEvents);
        }
      }

      res.status(200).json({
        success: true,
        details: {
          trackingNumber: shipment.externalTrackingNumber,
          description: shipment.itemDescription,
          isFlagged: shipment.isFlagged,
          exceptionType: shipment.exceptionType,
          pendingAction: shipment.pendingAction
        },
        timeline: timeline.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )
      });
    } catch (error) {
      res.status(500).json({ error: 'TIMELINE_FAILED' });
    }
  }

  /**
   * Task 2.4: POST /cargo/:importId/documents — Document Upload Endpoint.
   * Expects the Cloudinary URL from the client after direct upload.
   */
  public static async uploadDocument(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const shipment = await ImportRequest.findOne({ _id: id, userId });
      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      const { documentUrl, documentType } = req.body;
      if (!documentUrl) return res.status(400).json({ error: 'DOCUMENT_URL_REQUIRED' });

      if (documentType === 'COMMERCIAL_INVOICE') {
        if (!shipment.customsDeclaration) shipment.customsDeclaration = {};
        shipment.customsDeclaration.commercialInvoiceUrl = documentUrl;
      }

      // Auto-clear pending action if it was waiting for this document
      if (shipment.pendingAction?.type === 'UPLOAD_CUSTOMS_DOC') {
        shipment.pendingAction = undefined;
      }

      await shipment.save();
      res.status(200).json({ success: true, documentUrl });
    } catch (error) {
      res.status(500).json({ error: 'DOCUMENT_UPLOAD_FAILED' });
    }
  }

  /**
   * Task 2.5: GET /cargo/:importId/receipt — Structured receipt for delivered shipments.
   * Can be extended with pdfkit/puppeteer to generate an actual PDF later.
   */
  public static async getReceipt(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const shipment = await ImportRequest.findOne({ _id: id, userId })
        .populate<{ partnerId: any }>('partnerId', 'name')
        .lean();

      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });
      if (shipment.status !== ImportStatus.DELIVERED) {
        return res.status(400).json({ error: 'RECEIPT_ONLY_FOR_DELIVERED' });
      }

      const deliveredEntry = shipment.statusHistory.find(h => h.status === ImportStatus.DELIVERED);

      const receipt = {
        receiptNumber: `CX-REC-${(shipment._id as any).toString().slice(-8).toUpperCase()}`,
        issuedAt: new Date(),
        shipment: {
          trackingNumber: shipment.externalTrackingNumber,
          itemDescription: shipment.itemDescription,
          transportMode: shipment.transportMode,
          originCountry: shipment.originCountry,
        },
        weights: {
          verified: shipment.chargeableWeightKg ?? shipment.intake_weight,
          unit: 'kg'
        },
        partner: shipment.partnerId?.name || 'CourierX Partner',
        financials: {
          totalFreightPaid: shipment.pricingSnapshot?.totalCustomerPaid ?? 0,
          domesticSurcharge: shipment.domesticSurcharge ?? 0,
          currency: 'USD'
        },
        dates: {
          declared: shipment.createdAt,
          delivered: deliveredEntry?.changedAt ?? shipment.updatedAt
        }
      };

      res.status(200).json({ success: true, receipt });
    } catch (error) {
      res.status(500).json({ error: 'RECEIPT_GENERATION_FAILED' });
    }
  }

  /**
   * initiateLocalHandoff: Customer requests local delivery for an arrived shipment.
   * Blocks if there are outstanding customs/surcharge balances (402).
   */
  public static async initiateLocalHandoff(req: Request, res: Response) {
    try {
      const { importId } = req.params;
      const { vehicleType, dropoffLandmark, dropoffLocation } = req.body;
      const userId = req.user?.userId;

      const shipment = await ImportRequest.findOne({ _id: importId, userId });
      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      if (shipment.status !== ImportStatus.READY_FOR_LOCAL_HANDOFF) {
        return res.status(400).json({ error: 'NOT_READY_FOR_HANDOFF' });
      }

      // Payment Capture Gate
      let outstandingBalance = 0;
      if (!shipment.isDomesticPaid) {
        outstandingBalance += shipment.domesticSurcharge || 0;
      }
      if (shipment.customsDeclaration?.hsCode && shipment.customsDeclaration?.declaredValue) {
        const { PricingService } = require('../services/PartnerPricingService');
        const customsDuty = await PricingService.estimateCustoms(
          shipment.customsDeclaration.hsCode,
          shipment.customsDeclaration.declaredValue
        );
        outstandingBalance += customsDuty;
      }
      if (outstandingBalance > 0) {
        return res.status(402).json({
          success: false,
          requiresPayment: true,
          amountDue: Number(outstandingBalance.toFixed(2)),
          currency: 'USD',
          redirectUrl: `/checkout/import/${shipment._id}`,
          message: 'Please settle outstanding domestic/customs balances before local delivery.'
        });
      }

      // Idempotency guard
      const idempotencyKey = `LOCAL_DELIVERY:${importId}`;
      const existingReq = await mongoose.model('Idempotency').findOne({ key: idempotencyKey });
      if (existingReq) {
        return res.status(200).json(existingReq.responseBody);
      }

      const session = await mongoose.startSession();
      try {
        let order: any;
        await session.withTransaction(async () => {
          [order] = await Order.create([{
            customerId: userId,
            pickupLocation: { type: 'Point', coordinates: [0, 0] },
            pickupLandmark: 'Partner Warehouse',
            dropoffLocation,
            dropoffLandmark,
            vehicleType,
            price: 5.0,
            commission: 1.0,
            verificationPin: '1234',
            status: 'PENDING'
          }], { session });

          shipment.localOrderId = order._id;
          shipment.status = ImportStatus.HANDED_OFF;
          shipment.statusHistory.push({
            status: ImportStatus.HANDED_OFF,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(userId),
            changedByRole: 'CUSTOMER',
            notes: `Customer requested local delivery with ${vehicleType}`
          });
          await shipment.save({ session });

          const { CustodyLog } = require('../models/CustodyLog');
          await CustodyLog.create([{
            importId: shipment._id,
            fromStatus: ImportStatus.READY_FOR_LOCAL_HANDOFF,
            toStatus: ImportStatus.HANDED_OFF,
            changedBy: userId,
            changedAt: new Date()
          }], { session });

          const responseBody = { success: true, orderId: order._id };
          await mongoose.model('Idempotency').create([{
            key: idempotencyKey,
            responseBody,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          }], { session });
        });

        return res.status(201).json({ success: true, orderId: order?._id });
      } finally {
        session.endSession();
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'HANDOFF_FAILED' });
    }
  }

  public static async updateStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { newStatus, notes } = req.body;
      const userId = req.user?.userId;

      if (!newStatus) {
        return res.status(400).json({ error: 'NEW_STATUS_REQUIRED' });
      }

      // 1. Fetch with ownership check (importOwnershipGuard already ran, but we need the live doc)
      const shipment = await ImportRequest.findOne({ _id: id, userId });
      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      const currentStatus = shipment.status as ImportStatus;

      // 2. FSM Gate — enforce the state machine (Phase 0.2)
      const { IMPORT_FSM } = require('../config/stateMachine');
      const allowedTransitions: ImportStatus[] = IMPORT_FSM[currentStatus] || [];
      if (!allowedTransitions.includes(newStatus as ImportStatus)) {
        return res.status(400).json({
          error: 'BAD_STATE_TRANSITION',
          message: `Cannot move from ${currentStatus} to ${newStatus}.`,
          allowedTransitions
        });
      }

      // 3. Customer-authority guard: customers can only trigger CANCELLED from DECLARED.
      // All other transitions are partner/system initiated via ImportPartnerController.
      const customerAllowed: Partial<Record<ImportStatus, ImportStatus[]>> = {
        [ImportStatus.DECLARED]: [ImportStatus.CANCELLED],
      };
      const custAllowed = customerAllowed[currentStatus] || [];
      if (!custAllowed.includes(newStatus as ImportStatus)) {
        return res.status(403).json({
          error: 'NOT_CUSTOMER_TRANSITION',
          message: `Transition to ${newStatus} must be performed by partner staff.`
        });
      }

      const oldStatus = shipment.status;

      // 4. Apply transition atomically
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          shipment.status = newStatus as ImportStatus;
          shipment.statusHistory.push({
            status: newStatus,
            changedAt: new Date(),
            changedBy: new Types.ObjectId(userId),
            changedByRole: 'CUSTOMER',
            notes: notes || `Customer initiated transition to ${newStatus}`
          });
          await shipment.save({ session });

          const { CustodyLog } = require('../models/CustodyLog');
          await CustodyLog.create([{
            importId: shipment._id,
            fromStatus: oldStatus,
            toStatus: newStatus,
            changedBy: userId,
            changedAt: new Date()
          }], { session });
        });
      } finally {
        session.endSession();
      }

      // 5. Phase 5.1: Fire notification (non-blocking)
      const { NotificationService } = require('../services/notificationService');
      NotificationService.sendImportStatusNotification({
        userId,
        importId: id,
        itemDescription: shipment.itemDescription,
        newStatus
      }).catch((err: Error) => console.error('[Notification] updateStatus notify failed:', err.message));

      return res.status(200).json({
        success: true,
        importId: id,
        previousStatus: oldStatus,
        currentStatus: newStatus
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'STATUS_UPDATE_FAILED' });
    }
  }

  public static async getPartners(req: Request, res: Response) {
    try {
      const partners = await PartnerOrganization.find({ status: 'ACTIVE' })
        .select('name operatingCountries publicProfile requestedAirRate requestedSeaRate airConfig seaConfig availableModes ratingStats');
      res.status(200).json({ success: true, partners });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_PARTNERS_FAILED' });
    }
  }

  /**
   * Task 7.3: POST /cargo/:importId/dispute — Create in-app dispute report.
   */
  public static async createDispute(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { problemType, description, photoUrls } = req.body;
      const userId = req.user?.userId;

      const shipment = await ImportRequest.findOne({ _id: id, userId });
      if (!shipment) return res.status(404).json({ error: 'IMPORT_NOT_FOUND' });

      shipment.isFlagged = true;
      if (['WEIGHT_DISCREPANCY', 'CUSTOMS_HOLD', 'DAMAGED', 'PROHIBITED', 'LOST'].includes(problemType)) {
        shipment.exceptionType = problemType;
      } else {
        shipment.exceptionType = 'DATA_INTEGRITY_FAILURE';
      }

      const photoNote = photoUrls?.length
        ? `\nPhoto evidence (${photoUrls.length}): ${photoUrls.join(', ')}`
        : '';

      shipment.statusHistory.push({
        status: shipment.status,
        changedAt: new Date(),
        changedBy: userId,
        changedByRole: 'CUSTOMER',
        notes: `Customer reported problem [${problemType}]: ${description}${photoNote}`
      });

      await shipment.save();

      const { CustodyLog } = require('../models/CustodyLog');
      await CustodyLog.create({
        importId: shipment._id,
        fromStatus: shipment.status,
        toStatus: `${shipment.status}_DISPUTE`,
        changedBy: userId,
        changedAt: new Date()
      });

      res.status(201).json({ success: true, message: 'Dispute report filed successfully.' });
    } catch (error) {
      res.status(500).json({ error: 'DISPUTE_FILING_FAILED' });
    }
  }
}