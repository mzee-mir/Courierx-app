import { Router } from 'express';
import { ImportController } from '../controllers/ImportController';
import { authenticateHardened, hydrateIdentity } from '../middleware/authMiddleware';
import { importOwnershipGuard } from '../middleware/importOwnershipGuard';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

// --- VALIDATION SCHEMAS ---
const declarationSchema = {
  body: z.object({
    externalTrackingNumber: z.string().min(3).max(50),
    itemDescription: z.string().min(2).max(150),
    originCountry: z.string().length(2),
    partnerId: z.string().optional(),
    transportMode: z.enum(['AIR', 'SEA']),
    preferredLocalVehicle: z.enum(['bajaj', 'car', 'truck']),
    dropoffLandmark: z.string().min(2),
    dropoffLocation: z.object({
      type: z.literal('Point'),
      coordinates: z.array(z.number()).length(2)
    }),
    estimatedWeightKg: z.number().positive().optional(),
    customsDeclaration: z.object({
      declaredValue: z.number().nonnegative().optional(),
      declaredCurrency: z.string().default('USD').optional(),
      hsCode: z.string().optional(),
      category: z.string().optional(),
      quantity: z.number().int().positive().optional(),
      countryOfManufacture: z.string().optional()
    }).optional(),
    dimensions: z.object({
      length: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional()
    }).optional()
  })
};

const updateStatusSchema = {
  body: z.object({
    newStatus: z.string().min(1),
    notes: z.string().max(500).optional()
  })
};

// --- GLOBAL PROTECTED ---
router.use(authenticateHardened);
router.use(hydrateIdentity);

/**
 * @desc Declare a new incoming package from a supplier
 */
router.post('/declare', validate(declarationSchema), ImportController.declare);

/**
 * @desc Task 2.2: Get paginated list of imports. ?status=active|history&cursor=...&limit=20
 */
router.get('/my-imports', ImportController.getMyImports);

/**
 * @desc Task 0.2 / Phase 2: Update import status (FSM-enforced, customer-initiated transitions only)
 * Applies to: PATCH /cargo/status/:id
 */
router.patch('/status/:id', importOwnershipGuard, validate(updateStatusSchema), ImportController.updateStatus);

/**
 * @desc List active cargo partners for the declaration dropdown
 */
router.get('/partners', ImportController.getPartners);

/**
 * @desc Task 2.1: Get a single import record (ownership enforced)
 */
router.get('/:id', importOwnershipGuard, ImportController.getOne);

/**
 * @desc Task 2.4: Upload a document (commercial invoice etc.) to an import
 */
router.post('/:id/documents', importOwnershipGuard, ImportController.uploadDocument);

/**
 * @desc Task 2.5: Get structured receipt for a delivered shipment
 */
router.get('/:id/receipt', importOwnershipGuard, ImportController.getReceipt);

/**
 * @desc Fetch the unified international + local delivery timeline
 */
router.get('/shipment/:id/timeline', importOwnershipGuard, ImportController.getUnifiedTimeline);

/**
 * @desc Request local delivery for an arrived shipment
 */
router.post('/shipment/:importId/request-delivery', importOwnershipGuard, ImportController.initiateLocalHandoff);

/**
 * @desc Task 7.3: File an in-app dispute report for a shipment
 */
router.post('/:id/dispute', importOwnershipGuard, ImportController.createDispute);

export default router;
