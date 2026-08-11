import { Router } from 'express';
import { getBalance, depositFunds,getTransactions } from '../controllers/walletController';
import { UserRole } from '../models/User';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/transactions', authenticate, getTransactions);
router.get('/balance', authenticate, getBalance);
router.post('/deposit', authenticate, depositFunds);

// Only Drivers/Merchants can withdraw
// router.post('/withdraw', authenticate, authorize([UserRole.DRIVER, UserRole.MERCHANT]), withdrawFunds);

export default router;