import { AuthPayload } from '../middleware/authMiddleware';

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: AuthPayload;
      idempotencyKey?: string;
      partnerStatus?: string; // 👈 Add this line to fix the error
    }
  }
}