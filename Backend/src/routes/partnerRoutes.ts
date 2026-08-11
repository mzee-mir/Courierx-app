import { Router } from 'express';
import { ImportPartnerController } from '../controllers/ImportPartnerController';
import { PartnerFinanceController } from '../controllers/PartnerFinanceController';
import { PartnerStaffController } from '../controllers/PartnerStaffController';

// Middleware
import { authenticateHardened, hydrateIdentity, enforceCapability } from '../middleware/authMiddleware';
import { checkPartnerStatus } from '../middleware/partnerGuard';
import { enforceCustody } from '../middleware/custodyGuard';
import { validate } from '../middleware/validate';

// Config & Types
import { z } from 'zod';
import { AdminImportController } from '../controllers/AdminImportController';
import { Permission } from '../enums/permissions';
import { adminLogin, verifySudoMode } from '../controllers/AdminAuthController';
import { createPartnerStaffSchema } from '../validations/admin.validation';
import { authLimiter, intakeLimiter, mutationLimiter } from '../middleware/rateLimiter';

const router = Router();

// --- VALIDATION SCHEMAS ---
const scanIntakeSchema = {
  body: z.object({
    trackingNumber: z.string().min(5),
    weight: z.number().min(0.01),
    binLocation: z.string().min(1),
    mode: z.enum(['AIR', 'SEA']),
    isFragile: z.boolean().default(false),
    locationId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    dimensions: z.object({
      l: z.number(),
      w: z.number(),
      h: z.number()
    }).optional()
  })
};

const resolveIntakeSchema = {
  body: z.object({
    cxCode: z.string(),
    trackingNumber: z.string(),
    itemDescription: z.string(),
    originCountry: z.string(),
    mode: z.enum(['AIR', 'SEA']),
    locationId: z.string(),
    weight: z.number()
  })
};

const createManifestSchema = {
  body: z.object({
    manifestCode: z.string().min(3),
    shippingMode: z.enum(['AIR', 'SEA']),
    shipmentIds: z.array(z.string()),
    originHub: z.string(),
    destinationHub: z.string(),
    metadata: z.object({
      estimatedArrival: z.string()
    }).optional()
  })
};


const transitionSchema = {
  body: z.object({
    nextStatus: z.string().optional(),
    actionCode: z.string().optional(),
    nextLocationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    notes: z.string().max(200).optional(),
    weight: z.number().optional(),
    evidenceIds: z.array(z.string()).optional(),
    photos: z.array(z.string()).optional()
  }).refine(data => data.nextStatus || data.actionCode, {
    message: "Either nextStatus or actionCode must be provided"
  })
};

// --- 🔓 PUBLIC PARTNER ACCESS ---
router.post('/login', authLimiter, adminLogin);
// Protect the Sudo check
router.post('/auth/verify-sudo', authLimiter, verifySudoMode);

// --- 🔒 PROTECTED TERMINAL OPERATIONS ---
router.use(authenticateHardened);
router.use(hydrateIdentity); // Re-verifies active status and physical assignedLocations
router.use(checkPartnerStatus); // Hard-blocks if Organization is SUSPENDED

/**
 * 1. DASHBOARD & MONITORING
 */
router.get('/dashboard/pulse', ImportPartnerController.getDashboardBriefing);
router.get('/my-inventory', ImportPartnerController.getMyInventory);

/**
 * 2. MICRO-OPS: INDIVIDUAL INTAKE
 
const intakeSchema = z.object({
  trackingNumber: z.string().min(5),
  weight: z.number().min(0.01).max(500),
  binLocation: z.string().min(1),
  mode: z.enum(['AIR', 'SEA']),
  isFragile: z.boolean().optional()
});
*/

router.post('/intake',
  intakeLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(scanIntakeSchema),
  ImportPartnerController.scanIntake
);

router.post('/quick-intake',
  intakeLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(scanIntakeSchema),
  ImportPartnerController.quickIntake
);

/**
 * 3. SHIPMENT EXECUTION (The Operation Console)
 */
router.get('/shipments/:id/authority', enforceCustody, ImportPartnerController.getShipmentAuthority);

router.patch('/shipments/:id/transition',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  enforceCustody, // 👈 THE PHYSICAL LOCK
  validate(transitionSchema),
  ImportPartnerController.transitionStatus
);

router.post(
  '/resolve-and-intake',
  intakeLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(resolveIntakeSchema),
  ImportPartnerController.resolveAndIntake
);

/**
 * 4. MACRO-OPS: BATCH CONSOLIDATION (Manifests)
 */
router.post('/manifest/draft',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  AdminImportController.initializeManifestDraft
);

router.get('/manifests/directory',
  enforceCapability(Permission.PARTNER_WRITE),
  AdminImportController.getActiveManifests,
);

router.get('/manifests/:id', AdminImportController.getManifestDetail);

router.patch('/manifest/draft/:id',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  AdminImportController.updateManifestDraft
);

router.post(
  '/manifest/consolidate',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(createManifestSchema), // Using the Zod schema we built
  AdminImportController.consolidateManifest
);

router.post('/manifest/:id/seal',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  AdminImportController.sealManifest
);

router.get('/manifests/:id/authority', AdminImportController.getManifestAuthority);

router.patch('/manifests/:id/transition',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  AdminImportController.transitionManifest // 👈 Includes status propagation to children
);

router.get('/shipments/track/:trackingNumber', ImportPartnerController.trackShipment);
router.get('/handoff/queue', ImportPartnerController.getHandoffQueue);
router.post('/shipments/:id/handoff', enforceCustody, mutationLimiter, ImportPartnerController.processHandoff)
/**
 * 5. DESTINATION OPS: UNSEALING & HANDOFF
 */
router.post('/manifests/:id/verify-item',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  ImportPartnerController.verifyUnsealItem
);

router.post('/manifests/:id/finalize',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  ImportPartnerController.finalizeUnsealing
);


/**
 * 6. STAFF & SELF MANAGEMENT
 */
router.get('/staff', enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.getStaffMembers);
router.post('/staff', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), validate(createPartnerStaffSchema), PartnerStaffController.createWorker);
router.patch('/staff/:id/status', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.toggleWorkerStatus);
router.get('/staff/:staffId/history', enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.getStaffLoginHistory);

router.patch('/profile/password', mutationLimiter, PartnerStaffController.updateSelfPassword);
router.patch('/staff/:id/permissions', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.updateWorkerPermissions);
router.patch('/profile/self', mutationLimiter, PartnerStaffController.updateSelfProfile);

router.get(
  '/settings/active-rates',
  enforceCapability(Permission.PARTNER_READ),
  ImportPartnerController.getActiveRateCard
);


router.get('/finance/summary', PartnerFinanceController.getFinanceSummary);
router.post('/finance/withdraw', PartnerFinanceController.requestWithdrawal);
//router.get('/finance/transactions', PartnerFinanceController.getTransactions);

//  My Locations (For Staff Assignment)
router.get('/my-locations', ImportPartnerController.getOrgLocations);

// Sudo Verification (For Step-Up Auth)
router.post('/auth/verify-sudo', authLimiter, verifySudoMode);
router.get('/audit-trail', ImportPartnerController.getOrgAuditTrail);

router.get('/inventory/blocked', ImportPartnerController.getBlockedInventory);
router.post('/shipments/:id/resolve-exception', enforceCustody, mutationLimiter, ImportPartnerController.resolveShipmentException);

router.get(
  '/profile/public',
  enforceCapability(Permission.SYSTEM_CONFIG), // Or PARTNER_WRITE
  ImportPartnerController.getSelfPublicProfile
);

// PATCH: Save changes from the form
router.patch(
  '/profile/public',
  mutationLimiter,
  enforceCapability(Permission.SYSTEM_CONFIG),
  ImportPartnerController.updatePublicProfile
);

router.post('/settings/locations', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), ImportPartnerController.createLocation);
router.patch('/settings/domestic-rate', mutationLimiter, enforceCapability(Permission.PARTNER_MANAGE_RATES), ImportPartnerController.updateDomesticRate);
// 👈 ADD THIS: This maps to /api/v1/partner/settings/rates
router.patch(
  '/settings/rates',
  mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG),
  ImportPartnerController.updatePartnerSettings);

router.patch('/settings/locations/:id', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), ImportPartnerController.updateLocation);
router.delete('/settings/locations/:id', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), ImportPartnerController.deleteLocation);

export default router;  