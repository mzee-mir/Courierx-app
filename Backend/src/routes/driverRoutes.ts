// routes/driverRoutes.ts
import { Router } from 'express';
import { DriverController } from '../controllers/DriverController';
import { authenticate, authorize, authorizeDriver } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';
import { ProfileController } from '../controllers/ProfileController';
import { OrderController } from '../controllers/OrderController';

const router = Router();

/**
 * @route GET /api/v1/driver/profile
 * @desc Get the driver's professional dossier
 */
router.get(
  '/profile', 
  authenticate, // User must be logged in
  // Note: We don't use authorizeDriver here so unverified 
  // drivers can check their status
  ProfileController.getDriverProfile 
);

router.get('/dashboard', authenticate, authorizeDriver, OrderController.getDriverDashboard);

router.get('/orders', authenticate, authorizeDriver, OrderController.getDriverOrders);

/**
 * @route POST /api/v1/driver/profile
 * @desc Submit onboarding documents (Driver context)
 * @access Private (Authenticated, unverified drivers allowed)
 */
router.post(
  '/profile', 
  authenticate, // User must be logged in
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
  authenticate,
  authorize([UserRole.DRIVER]),
  DriverController.updateLocation
);

router.patch(
  '/driver/profile/avatar', 
  authenticate, 
  ProfileController.updateDriverAvatar
);

/**
 * @route GET /api/v1/driver/nearby
 * @desc Find active drivers near coordinates
 * @access Private (Both Customers and Drivers can use this)
 */
router.get(
  '/nearby', 
  authenticate, 
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
  authenticate,      // 1. Who are you?
  authorizeDriver,   // 2. Are you a verified driver?
  DriverController.toggleStatus
);

export default router;
