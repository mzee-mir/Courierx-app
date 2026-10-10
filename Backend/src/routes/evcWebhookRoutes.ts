import { Router, raw } from 'express';
import { evcWebhookHandler } from '../controllers/evcWebhookController';
import { mutationLimiter } from '../middleware/rateLimiter';

/**
 * Provider callback router.
 * Mounted BEFORE the global express.json so the raw body is preserved for
 * HMAC signature verification (see index.ts).
 */
const router = Router();

router.post(
  '/evc',
  raw({ type: 'application/json', limit: '10kb' }),
  mutationLimiter,
  (req, res, next) => {
    (req as any).rawBody = (req as any).body;
    try {
      (req as any).body = JSON.parse((req as any).body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'INVALID_JSON' });
    }
    next();
  },
  evcWebhookHandler
);

export default router;
