// routes/profileRoutes.ts
import { Router } from 'express';
import { ProfileController } from '../controllers/ProfileController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();
/**
 * @route   GET /api/v1/profile
 * @desc    Retrieve the authenticated user's profile and saved landmarks
 * @access  Private
 */

router.get(
  '/landmarks', 
  authenticate, 
  ProfileController.getLandmarks
);

/**
 * @route   GET /api/v1/profile
 * @desc    Retrieve the authenticated user's profile and saved landmarks
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  ProfileController.getProfile
);

/**
 * @route   PATCH /api/v1/profile
 * @desc    Update basic profile information (e.g., displayName)
 * @access  Private
 */
router.patch(
  '/',
  authenticate,
  ProfileController.updateProfile
);

/**
 * @route   POST /api/v1/profile/landmarks
 * @desc    Create a new saved landmark (e.g., Home, Work)
 * @access  Private
 */
router.post(
  '/landmarks',
  authenticate,
  ProfileController.createLandmark
);

router.patch('/push-token', authenticate, ProfileController.updatePushToken);

/**
 * @route   PATCH /api/v1/profile/notification-preferences
 * @desc    Task 5.3b: Update per-event import notification preferences
 * @access  Private
 */
router.patch('/notification-preferences', authenticate, ProfileController.updateNotificationPreferences);


/**
 * @route   DELETE /api/v1/profile/landmarks/:id
 * @desc    Remove a saved landmark by ID
 * @access  Private
 */
router.delete(
  '/landmarks/:id',
  authenticate,
  ProfileController.deleteLandmark
);

export default router;