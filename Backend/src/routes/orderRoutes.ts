// routes/orderRoutes.ts
import { Router } from 'express';
import { OrderController } from '../controllers/OrderController';
import { authenticate, authorize, authorizeDriver } from '../middleware/authMiddleware';
import { UserRole } from '../models/User';

const router = Router();


/**
 * @route   GET /api/v1/orders
 * @desc    Get order history for the logged-in customer
 * @access  Private/Customer
 */
router.get(
  '/',
  authenticate,
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
  authenticate, 
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
  authenticate,
  authorize([UserRole.CUSTOMER]),
  OrderController.create
);

/**
 * @route   PATCH /api/v1/orders/:id/accept
 * @desc    Driver accepts a pending order
 * @access  Private/Driver
 */
router.patch(
  '/:id/accept',
  authenticate,
  authorizeDriver,
  OrderController.accept
);

/**
 * @route   PATCH /api/v1/orders/:id/status
 * @desc    Transition order status (PICKED_UP, ARRIVED)
 * @access  Private/Driver
 */
router.patch(
  '/:id/status', 
  authenticate, 
  authorizeDriver, // This checks 'isVerified' in the JWT
  OrderController.updateStatus
);

/**
 * @route   POST /api/v1/orders/:id/verify
 * @desc    Finalize delivery with 4-digit PIN and trigger wallet settlement
 * @access  Private/Driver
 */
router.post(
  '/:id/verify',
  authenticate,
  authorizeDriver,
  OrderController.verifyAndComplete
);

router.delete(
  '/:id', 
  authenticate, 
  authorize([UserRole.CUSTOMER]), 
  OrderController.deleteOrder
);

export default router;