import { Router } from 'express';
import { getBalance, depositFunds, getTransactions, checkTransactionStatus } from '../controllers/walletController';
import { UserRole } from '../models/User';
import { authenticateHardened, hydrateIdentity, authorize } from '../middleware/authMiddleware';
import { mutationLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { depositSchema } from '../validations/wallet.validation';

const router = Router();

/**
 * HARDENED IDENTITY (M6): Wallet routes re-read the user from the DB so role
 * changes/suspensions take effect immediately (no reliance on stale JWT claims).
 */
router.use(authenticateHardened);
router.use(hydrateIdentity);

router.get('/transactions', getTransactions);
router.get('/balance', getBalance);
router.post('/deposit', authorize([UserRole.CUSTOMER]), validate(depositSchema), mutationLimiter, depositFunds);
router.get('/status/:id', checkTransactionStatus);

export default router;
