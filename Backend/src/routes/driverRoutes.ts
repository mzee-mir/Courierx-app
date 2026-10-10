// routes/driverRoutes.ts
import { Router } from 'express';
import { DriverController } from '../controllers/DriverController';
import { authenticateHardened, authorize, authorizeDriver, hydrateIdentity } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';
import { ProfileController } from '../controllers/ProfileController';
import { OrderController } from '../controllers/OrderController';
import { validate } from '../middleware/validate';
import { toggleStatusSchema, updateLocationSchema } from '../validations/driver.validation';

const router = Router();

// --- HARDENED AUTH: Live session re-validation + token-version check on every driver call.
// Soft-gate preserved: routes below omit `authorizeDriver` so unverified drivers can still
// submit onboarding docs and check their verification status.
router.use(authenticateHardened);
router.use(hydrateIdentity);

/**
 * @route GET /api/v1/driver/profile
 * @desc Get the driver's professional dossier
 */
router.get(
  '/profile', 
  // Note: We don't use authorizeDriver here so unverified 
  // drivers can check their status
  ProfileController.getDriverProfile 
);

router.get('/dashboard', authorizeDriver, OrderController.getDriverDashboard);

router.get('/orders', authorizeDriver, OrderController.getDriverOrders);

/**
 * @route POST /api/v1/driver/profile
 * @desc Submit onboarding documents (Driver context)
 * @access Private (Authenticated, unverified drivers allowed)
 */
router.post(
  '/profile', 
  // Note: We do NOT use authorizeDriver here because the driver 
  // isn't verified yet!
  ProfileController.submitDriverOnboarding 
);

/**
 * @route   POST /api/v1/driver/location
 * @desc    Update driver's current GPS coordinates (High-frequency ping)
 * @access  Private/Driver
 */
router.post(
  '/location',
  authorize([UserRole.DRIVER]),
  validate(updateLocationSchema),
  DriverController.updateLocation
);

router.patch(
  '/driver/profile/avatar', 
  ProfileController.updateDriverAvatar
);

/**
 * @route GET /api/v1/driver/nearby
 * @desc Find active drivers near coordinates
 * @access Private (Both Customers and Drivers can use this)
 */
router.get(
  '/nearby', 
  // Note: We do NOT use authorizeDriver here because 
  // Customers need to call this to see the map!
  DriverController.getNearbyDrivers
);


/**
 * @route   PATCH /api/v1/driver/status
 * @desc    Toggle driver availability (Online/Offline) for dispatching
 * @access  Private/Driver
 */
router.patch(
  '/status',
  authorizeDriver,   // 2. Are you a verified driver?
  validate(toggleStatusSchema),
  DriverController.toggleStatus
);

export default router;
