import { Router, Request, Response } from 'express';
import { UploadController } from '../controllers/uploadController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

/**
 * @route GET /api/v1/uploads/health
 * @desc Verify the upload service is reachable
 * @access Public
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'Upload service active' });
});

/**
 * @route GET /api/v1/uploads/cloudinary-signature
 * @desc Get signed data for direct-to-cloud upload
 * @access Private
 */
router.get('/cloudinary-signature', authenticate, UploadController.getCloudinarySignature);

export default router;