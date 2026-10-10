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

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const initManifestDraftSchema = {
  body: z.object({
    shippingMode: z.enum(['AIR', 'SEA']),
    originHub: z.string().min(1),
    destinationHub: z.string().min(1)
  })
};

const updateManifestDraftSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    shipmentIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
    metadata: z.object({
      containerNumber: z.string().optional(),
      vesselName: z.string().optional(),
      estimatedArrival: z.string().optional()
    }).optional()
  }).refine(data => data.shipmentIds || data.metadata, { message: 'At least one field required' })
};

const manifestIdSchema = {
  params: z.object({ id: objectId })
};

const verifyUnsealSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    trackingNumber: z.string().min(1),
    arrivalWeight: z.number().positive().optional(),
    notes: z.string().max(300).optional(),
    photos: z.array(z.string()).optional()
  })
};

const finalizeUnsealingSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    closingDescription: z.string().min(1).max(300).optional()
  })
};

const shipmentIdSchema = {
  params: z.object({ id: objectId })
};

const toggleWorkerStatusSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ isSuspended: z.boolean() })
};

const updateWorkerPermissionsSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    permissions: z.array(z.string()).min(1)
  })
};

const updateSelfPasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8)
  }).refine(data => data.currentPassword !== data.newPassword, { message: 'New password must differ from current' })
};

const updateSelfProfileSchema = {
  body: z.object({
    displayName: z.string().min(1).max(100).optional(),
    imageUrl: z.string().url().optional()
  }).refine(data => data.displayName || data.imageUrl, { message: 'At least one field required' })
};

const requestWithdrawalSchema = {
  body: z.object({
    amount: z.number().positive().max(100000)
  })
};

const resolveExceptionSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    resolutionAction: z.enum(['RELEASE', 'CANCEL', 'RETURN']),
    notes: z.string().max(300).optional()
  })
};

const createLocationSchema = {
  body: z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['WAREHOUSE', 'PORT', 'TRANSIT_HUB']),
    country: z.string().min(1),
    city: z.string().min(1),
    address: z.string().min(1)
  })
};

const updateDomesticRateSchema = {
  body: z.object({
    ratePerKg: z.number().positive().max(1000)
  })
};

const updatePartnerSettingsSchema = {
  body: z.object({
    airRate: z.number().positive(),
    seaRate: z.number().positive(),
    dailyIntakeTarget: z.number().int().positive().optional(),
    reason: z.string().max(300).optional()
  })
};

const updateLocationSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['WAREHOUSE', 'PORT', 'TRANSIT_HUB']).optional(),
    country: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    address: z.string().min(1).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })
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
  validate(initManifestDraftSchema),
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
  validate(updateManifestDraftSchema),
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
  validate(manifestIdSchema),
  AdminImportController.sealManifest
);

router.get('/manifests/:id/authority', AdminImportController.getManifestAuthority);

router.patch('/manifests/:id/transition',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(transitionSchema),
  AdminImportController.transitionManifest // 👈 Includes status propagation to children
);

router.get('/shipments/track/:trackingNumber', ImportPartnerController.trackShipment);
router.get('/handoff/queue', ImportPartnerController.getHandoffQueue);
router.post('/shipments/:id/handoff', enforceCustody, mutationLimiter, validate(shipmentIdSchema), ImportPartnerController.processHandoff)
/**
 * 5. DESTINATION OPS: UNSEALING & HANDOFF
 */
router.post('/manifests/:id/verify-item',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(verifyUnsealSchema),
  ImportPartnerController.verifyUnsealItem
);

router.post('/manifests/:id/finalize',
  mutationLimiter,
  enforceCapability(Permission.PARTNER_WRITE),
  validate(finalizeUnsealingSchema),
  ImportPartnerController.finalizeUnsealing
);


/**
 * 6. STAFF & SELF MANAGEMENT
 */
router.get('/staff', enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.getStaffMembers);
router.post('/staff', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), validate(createPartnerStaffSchema), PartnerStaffController.createWorker);
router.patch('/staff/:id/status', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), validate(toggleWorkerStatusSchema), PartnerStaffController.toggleWorkerStatus);
router.get('/staff/:staffId/history', enforceCapability(Permission.MANAGE_STAFF), PartnerStaffController.getStaffLoginHistory);

router.patch('/profile/password', mutationLimiter, validate(updateSelfPasswordSchema), PartnerStaffController.updateSelfPassword);
router.patch('/staff/:id/permissions', mutationLimiter, enforceCapability(Permission.MANAGE_STAFF), validate(updateWorkerPermissionsSchema), PartnerStaffController.updateWorkerPermissions);
router.patch('/profile/self', mutationLimiter, validate(updateSelfProfileSchema), PartnerStaffController.updateSelfProfile);

router.get(
  '/settings/active-rates',
  enforceCapability(Permission.PARTNER_READ),
  ImportPartnerController.getActiveRateCard
);


router.get('/finance/summary', enforceCapability(Permission.PARTNER_FINANCE), PartnerFinanceController.getFinanceSummary);
router.post('/finance/withdraw', enforceCapability(Permission.PARTNER_FINANCE), mutationLimiter, validate(requestWithdrawalSchema), PartnerFinanceController.requestWithdrawal);
//router.get('/finance/transactions', PartnerFinanceController.getTransactions);

//  My Locations (For Staff Assignment)
router.get('/my-locations', ImportPartnerController.getOrgLocations);

// Sudo Verification (For Step-Up Auth)
router.post('/auth/verify-sudo', authLimiter, verifySudoMode);
router.get('/audit-trail', ImportPartnerController.getOrgAuditTrail);

router.get('/inventory/blocked', ImportPartnerController.getBlockedInventory);
router.post('/shipments/:id/resolve-exception', enforceCustody, mutationLimiter, validate(resolveExceptionSchema), ImportPartnerController.resolveShipmentException);

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

router.post('/settings/locations', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), validate(createLocationSchema), ImportPartnerController.createLocation);
router.patch('/settings/domestic-rate', mutationLimiter, enforceCapability(Permission.PARTNER_MANAGE_RATES), validate(updateDomesticRateSchema), ImportPartnerController.updateDomesticRate);
// 👈 ADD THIS: This maps to /api/v1/partner/settings/rates
router.patch(
  '/settings/rates',
  mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG),
  validate(updatePartnerSettingsSchema),
  ImportPartnerController.updatePartnerSettings);

router.patch('/settings/locations/:id', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), validate(updateLocationSchema), ImportPartnerController.updateLocation);
router.delete('/settings/locations/:id', mutationLimiter, enforceCapability(Permission.SYSTEM_CONFIG), validate(manifestIdSchema), ImportPartnerController.deleteLocation);

export default router;  