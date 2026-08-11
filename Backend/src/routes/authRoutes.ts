import { Router } from 'express';
import { verifyIdentity } from '../controllers/authController';

const router = Router();

/**
 * @route POST /api/v1/auth/verify
 * @desc Verify Firebase ID Token and issue internal JWT
 * @access Public (Requires valid Firebase Token)
 */
router.post('/verify', verifyIdentity);

export default router;