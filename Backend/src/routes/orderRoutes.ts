// routes/orderRoutes.ts
import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authenticateHardened, hydrateIdentity, authorize, authorizeDriver } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { UserRole } from '../models/User';
import { createOrderSchema, acceptOrderSchema, updateOrderStatusSchema, verifyOrderSchema } from '../validations/order.validation';
import { mutationLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * HARDENED IDENTITY (M6): Every order route re-reads the user from the DB.
 * - authenticateHardened re-fetches roles from the DB (demotions take effect immediately).
 * - hydrateIdentity re-checks suspension + tokenVersion and refreshes
 *   partnerId/assignedLocations.
 * isVerified is intentionally NOT overwritten here — authorizeDriver keeps reading
 * it from the JWT, which preserves the driver-onboarding gate (a freshly verified
 * driver must re-login to obtain an isVerified:true token).
 */
router.use(authenticateHardened);
router.use(hydrateIdentity);


/**
 * @route   GET /api/v1/orders
 * @desc    Get order history for the logged-in customer
 * @access  Private/Customer
 */
router.get(
  '/',
  authorize([UserRole.CUSTOMER]),
  OrderController.getMyOrders
);

/**
 * @route   GET /api/v1/orders/:id
 * @desc    Fetch specific order (Visible to both Customer and Driver)
 * @access  Private
 */
router.get(
  '/:id', 
  // ✅ FIX: Include UserRole.DRIVER in the allowed array
  authorize([UserRole.CUSTOMER, UserRole.DRIVER]), 
  OrderController.getOrderById
);
/**
 * @route   POST /api/v1/orders
 * @desc    Create a new delivery order (Customer only)
 * @access  Private/Customer
 */
router.post(
  '/',
  authorize([UserRole.CUSTOMER]),
  validate(createOrderSchema),
  OrderController.create
);

/**
 * @route   PATCH /api/v1/orders/:id/accept
 * @desc    Driver accepts a pending order
 * @access  Private/Driver
 */
router.patch(
  '/:id/accept',
  authorizeDriver,
  validate(acceptOrderSchema),
  OrderController.accept
);

/**
 * @route   POST /api/v1/orders/:id/offers/reject
 * @desc    Driver explicitly declines an active targeted offer
 * @access  Private/Driver
 */
router.post(
  '/:id/offers/reject',
  authorizeDriver,
  OrderController.rejectOffer
);

/**
 * @route   POST /api/v1/orders/:id/offers/seen
 * @desc    Driver app confirms the offer was rendered/seen on screen
 * @access  Private/Driver
 */
router.post(
  '/:id/offers/seen',
  authorizeDriver,
  OrderController.seenOffer
);

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Transition order status (PICKED_UP, ARRIVED)
 * @access  Private/Driver
 */
router.patch(
  '/:id/status', 
  authorizeDriver, // This checks 'isVerified' in the JWT
  validate(updateOrderStatusSchema),
  OrderController.updateStatus
);

/**
 * @route   POST /api/v1/orders/:id/verify
 * @desc    Finalize delivery with 4-digit PIN and trigger wallet settlement
 * @access  Private/Driver
 */
router.post(
  '/:id/verify',
  authorizeDriver,
  validate(verifyOrderSchema),
  mutationLimiter, // Prevents PIN brute-force and drive-by settlement attempts
  OrderController.verifyAndComplete
);

/**
 * @route   GET /api/v1/orders/:id/pin
 * @desc    Owner-only: retrieve the delivery PIN for the recipient
 * @access  Private/Customer (order owner)
 */
router.get(
  '/:id/pin',
  authorize([UserRole.CUSTOMER]),
  OrderController.getOrderPin
);

/**
 * @route   POST /api/v1/orders/:id/landmark-feedback
 * @desc    Driver submits 1-tap post-delivery landmark accuracy feedback
 * @access  Private/Driver
 */
router.post(
  '/:id/landmark-feedback',
  authorizeDriver,
  OrderController.submitLandmarkFeedback
);

router.delete(
  '/:id', 
  authorize([UserRole.CUSTOMER]), 
  OrderController.deleteOrder
);

export default router;