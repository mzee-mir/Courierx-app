import { Router } from 'express';
import { adminLogin, verifySudoMode } from '../controllers/AdminAuthController';
import { AdminController } from '../controllers/AdminController';
import { authenticate, authenticateHardened, authorizeAdmin, enforceCapability, hydrateIdentity } from '../middleware/authMiddleware'; // 👈 Use new authorizeAdmin
import { UserRole } from '../models/User';
import { AdminOpsController } from '../controllers/AdminOpsController';
import { AdminImportController } from '../controllers/AdminImportController';
import { AdminFinanceController } from '../controllers/AdminFinanceController';
import { NotificationService } from '../services/notificationService';
import { ShipmentLog } from '../models/ShipmentLog';
import { SystemSettings } from '../models/SystemSettings';
import { CargoPartner } from '../models/CargoPartner';
import { validate } from '../middleware/validate';
import { verifyDriverSchema } from '../validations/admin.validation';
import { Permission } from '../enums/permissions';
import { AdminPartnerController } from '../controllers/AdminPartnerController';
import { requireSudo } from '../middleware/sudoGuard';
import { AdminNotificationController } from '../controllers/AdminNotificationController';

const router = Router();

// --- PUBLIC ---
router.post('/login', adminLogin);

// --- GLOBAL PROTECTED (Must be an Admin of any type) ---
router.use(authenticateHardened);
router.use(hydrateIdentity); // Prevents stale sessions/demoted staf

// --- DASHBOARD & STATS (Super, Ops, Finance) ---
router.get('/stats/overview', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
    UserRole.OPS_ADMIN, UserRole.FINANCE_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.SUPPORT_ADMIN]), 
    AdminController.getDashboardStats
);

router.get('/stats/daily-pulse', AdminController.getDailyPulse);

// --- DRIVER MANAGEMENT (Super & Ops Only) ---
router.get('/drivers/pending', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.PENDING_DRIVERS),
    AdminController.getPendingDrivers
);
router.patch('/drivers/:id/verify', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), 
    validate(verifyDriverSchema),
    enforceCapability(Permission.VERIFY_DRIVERS),
    AdminController.verifyDriver
);
router.get('/drivers/:id/detail', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.VIEW_DRIVER_DETAILS),
    AdminController.getDriverFullDetail
);

// --- USER & CUSTOMER SUPPORT (Super, Support, Ops) ---
router.get('/users', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.OPS_ADMIN]),
    enforceCapability(Permission.VIEW_ALL_USERS),
    AdminController.getAllUsers
);
router.patch('/users/:id/status', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.USER_STATUS_CHANGE),
    AdminController.toggleUserStatus
);
router.get('/customers/insights', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.CUSTOMER_INSIGHTS),
    AdminController.getCustomerInsights
);

router.get('/finance/revenue-stats', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN, UserRole.FINANCE_ADMIN]), 
    AdminFinanceController.getRevenueStats);

router.get('/drivers/leaderboard', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.VIEW_DRIVER_LEADERBOARD),
    AdminController.getDriverLeaderboard);

router.get('/customers/insights/vips', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.VIP_MASTERLIST),
    AdminController.getVIPMasterlist);
router.get('/customers/insights/dormant', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.DORMANT_MASTERLIST),
    AdminController.getDormantMasterlist);

router.get('/customers/insights/risk', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.RISK_MASTERLIST),
    AdminController.getRiskMasterlist);

// --- OPERATIONS & ORDERS (Super & Ops Only) ---
router.get('/orders/active', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.ACTIVE_ORDERS),
    AdminOpsController.getActiveOrders
);
router.post('/orders/:orderId/unassign', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.INTERVENE_ORDERS),
    AdminOpsController.forceUnassign
);
router.post('/orders/:orderId/cancel', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.INTERVENE_ORDERS),
    AdminOpsController.adminCancelOrder
);
router.patch('/orders/:orderId/dispute', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN, UserRole.SUPPORT_ADMIN]), 
    enforceCapability(Permission.INTERVENE_ORDERS),
    AdminOpsController.toggleDispute
);
router.get('/orders/history', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.SUPPORT_ADMIN, UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.VIEW_ALL_ORDERS),
    AdminController.getOrderHistory
);

router.post('/imports/:id/resolve', 
  authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.SUPPORT_ADMIN, UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.RESOLVE_IMPORT_EXCEPTIONS), 
  AdminPartnerController.resolveException
);

router.patch('/imports/:shipmentId/force-state', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.SUPPORT_ADMIN, UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.FORCE_SHIPMENT_STATE), 
  AdminPartnerController.adminForceState
);

// --- FINANCE & PAYMENTS (Super & Finance Only) ---
router.get('/finance/pending-deposits', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.FINANCE_ADMIN]), 
    enforceCapability(Permission.MANAGE_FINANCE),
    AdminFinanceController.getPendingDeposits
);
router.post('/finance/confirm-deposit/:transactionId', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.FINANCE_ADMIN]), 
    enforceCapability(Permission.CONFIRM_DEPOSITS),
    AdminFinanceController.confirmDeposit
);
router.get('/finance/withdrawals', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.FINANCE_ADMIN]), 
    enforceCapability(Permission.VIEW_WITHDRAWALS),
    AdminFinanceController.getPendingWithdrawals
);
router.post('/finance/withdrawals/:transactionId/complete', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.FINANCE_ADMIN]), 
    enforceCapability(Permission.PROCESS_WITHDRAWALS),
    AdminFinanceController.completeWithdrawal
);
router.get('/audit-logs',  
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.FINANCE_ADMIN]), 
    enforceCapability(Permission.VIEW_AUDIT_LOGS),
    AdminController.getAuditLogs
);

router.post(
  '/imports/manifest/consolidate',
  authenticateHardened,
  hydrateIdentity,
  enforceCapability(Permission.FORCE_SHIPMENT_STATE), 
  AdminImportController.consolidateManifest
);

// --- 🛡️ 2-MAN RULE (Pending Actions) ---
router.get('/actions/pending', 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  AdminController.getPendingActions
);
router.post('/actions/:actionId/approve', 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  AdminController.approvePendingAction
);


//--- STAFF ADMIN MANAGEMENT (Super Admin ONLY) ---
router.get('/staff', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
AdminController.getStaffMembers);

router.post('/staff', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
AdminController.createStaffAdmin);

router.patch('/staff/:id', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
AdminController.updateStaffAdmin);

router.delete('/staff/:id', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
requireSudo,
AdminController.deleteStaff);

router.post('/users/:id/terminate-sessions', authenticateHardened, 
    hydrateIdentity, enforceCapability(Permission.MANAGE_STAFF), 
    requireSudo, 
    AdminController.terminateUserSessions);
router.get('/staff/:id', 
    authenticateHardened, 
    hydrateIdentity, enforceCapability(Permission.MANAGE_STAFF), 
    AdminController.getStaffDetail);


// --- IMPORTS & PARTNERS (Super & Ops Only) ---
router.get('/partners', 
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), 
    async (req, res) => {
        const partners = await CargoPartner.find().sort({ name: 1 });
        res.json({ success: true, partners });
    }
);
router.post('/partners', authorizeAdmin([UserRole.SUPER_ADMIN]), enforceCapability(Permission.ONBOARD_PARTNERS), AdminImportController.createPartner);
router.get('/imports/unassigned', authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), enforceCapability(Permission.INTERVENE_IMPORTS), AdminImportController.getUnassignedImports);
router.patch('/imports/:requestId/assign', authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), enforceCapability(Permission.INTERVENE_IMPORTS), AdminImportController.assignPartners);
router.get('/imports/:id/timeline', authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), async (req, res) => {
    const logs = await ShipmentLog.find({ importRequestId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, logs });
});

// Sudo Mode Entry
router.post('/auth/sudo', authenticateHardened, verifySudoMode);

// --- SYSTEM ADMINISTRATION (Super Admin ONLY) ---
router.get('/settings/schema', 
    authorizeAdmin([UserRole.SUPER_ADMIN]),
    AdminController.getSettingsSchema);
router.get('/settings', 
    authorizeAdmin([UserRole.SUPER_ADMIN]),
    AdminController.getSystemSettings);
router.patch('/settings/:key', 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  AdminController.updateSystemSetting
);


// STAGED BROADCASTS
router.post('/broadcast/draft', 
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  AdminNotificationController.createDraft
);
router.post('/broadcast/:id/execute', 
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  AdminNotificationController.execute
);

export default router;