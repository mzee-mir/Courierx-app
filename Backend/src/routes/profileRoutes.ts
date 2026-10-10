// routes/profileRoutes.ts
import { Router } from 'express';
import { ProfileController } from '../controllers/ProfileController';
import { authenticateHardened, hydrateIdentity } from '../middleware/authMiddleware';

const router = Router();

// HARDENED AUTH: Live session re-validation + token-version check on all profile calls.
router.use(authenticateHardened);
router.use(hydrateIdentity);

/**
 * @route   GET /api/v1/profile
 * @desc    Retrieve the authenticated user's profile and saved landmarks
 * @access  Private
 */

router.get(
  '/landmarks', 
  ProfileController.getLandmarks
);

/**
 * @route   GET /api/v1/profile
 * @desc    Retrieve the authenticated user's profile and saved landmarks
 * @access  Private
 */
router.get(
  '/',
  ProfileController.getProfile
);

/**
 * @route   PATCH /api/v1/profile
 * @desc    Update basic profile information (e.g., displayName)
 * @access  Private
 */
router.patch(
  '/',
  ProfileController.updateProfile
);

/**
 * @route   POST /api/v1/profile/landmarks
 * @desc    Create a new saved landmark (e.g., Home, Work)
 * @access  Private
 */
router.post(
  '/landmarks',
  ProfileController.createLandmark
);

router.patch('/push-token', ProfileController.updatePushToken);

/**
 * @route   PATCH /api/v1/profile/notification-preferences
 * @desc    Task 5.3b: Update per-event import notification preferences
 * @access  Private
 */
router.patch('/notification-preferences', ProfileController.updateNotificationPreferences);


/**
 * @route   DELETE /api/v1/profile/landmarks/:id
 * @desc    Remove a saved landmark by ID
 * @access  Private
 */
router.delete(
  '/landmarks/:id',
  ProfileController.deleteLandmark
);

export default router;