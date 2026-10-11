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
import { authLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';

const router = Router();

// --- VALIDATION SCHEMAS ---
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

const cancelOrderSchema = {
  params: z.object({ orderId: objectId }),
  body: z.object({ reason: z.string().min(3).max(500) })
};

const forceUnassignSchema = {
  params: z.object({ orderId: objectId })
};

const disputeSchema = {
  params: z.object({ orderId: objectId }),
  body: z.object({
    isDisputed: z.boolean(),
    note: z.string().max(500).optional()
  })
};

const adminForceStateSchema = {
  params: z.object({ shipmentId: objectId }),
  body: z.object({
    newState: z.string().min(1).max(50),
    reason: z.string().max(300).optional(),
    bypassFSM: z.boolean().optional(),
    nextLocationId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
  })
};

const resolveExceptionSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    action: z.enum(['PROCEED', 'CANCEL']),
    resolutionNote: z.string().max(300).optional()
  })
};

const createStaffSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().min(1).max(100),
    role: z.enum(['super_admin', 'ops_admin', 'finance_admin', 'support_admin'])
  })
};

const updateStaffSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    displayName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    role: z.enum(['super_admin', 'ops_admin', 'finance_admin', 'support_admin']).optional(),
    password: z.string().min(8).optional()
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one field required' })
};

const deleteStaffSchema = {
  params: z.object({ id: objectId })
};

const updateSettingSchema = {
  params: z.object({ key: z.string().min(1).max(100) }),
  body: z.object({
    value: z.unknown(),
    reason: z.string().max(300).optional()
  })
};

const terminateSessionsSchema = {
  params: z.object({ id: objectId })
};

const approveActionSchema = {
  params: z.object({ actionId: objectId })
};

const createPartnerSchema = {
  body: z.object({
    name: z.string().min(1),
    logoUrl: z.string().url().optional(),
    baseRatePerKg: z.number().nonnegative(),
    estimatedTransitDays: z.number().int().positive(),
    warehouses: z.array(z.object({
      country: z.string().min(1),
      city: z.string().min(1),
      fullAddress: z.string().min(1),
      contactNumber: z.string().min(1)
    })).optional(),
    isActive: z.boolean().optional(),
    supportedRoutes: z.array(z.string()).optional()
  })
};

const assignPartnersSchema = {
  params: z.object({ requestId: objectId }),
  body: z.object({
    chinaAgentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    freightPartnerId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    clearingAgentId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional()
  }).refine(data => data.chinaAgentId || data.freightPartnerId || data.clearingAgentId, { message: 'Must specify at least one assignment' })
};

// --- PUBLIC ---
router.post('/login', authLimiter, adminLogin);

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
    validate({ params: z.object({ id: objectId }) }),
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
router.get('/operations/summary',
    authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]),
    enforceCapability(Permission.OPS_SUMMARY),
    AdminOpsController.getOperationsSummary
);
router.get('/orders/active', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    enforceCapability(Permission.ACTIVE_ORDERS),
    AdminOpsController.getActiveOrders
);
router.post('/orders/:orderId/unassign', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    validate(forceUnassignSchema),
    enforceCapability(Permission.INTERVENE_ORDERS),
    AdminOpsController.forceUnassign
);
router.post('/orders/:orderId/cancel', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN]), 
    validate(cancelOrderSchema),
    enforceCapability(Permission.INTERVENE_ORDERS),
    AdminOpsController.adminCancelOrder
);
router.patch('/orders/:orderId/dispute', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.OPS_ADMIN, UserRole.SUPPORT_ADMIN]), 
    validate(disputeSchema),
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
    validate(resolveExceptionSchema),
    enforceCapability(Permission.RESOLVE_IMPORT_EXCEPTIONS), 
  AdminPartnerController.resolveException
);

router.patch('/imports/:shipmentId/force-state', 
    authorizeAdmin([UserRole.SUPER_ADMIN, 
        UserRole.SUPPORT_ADMIN, UserRole.OPS_ADMIN]), 
    validate(adminForceStateSchema),
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
    validate({ params: z.object({ transactionId: objectId }) }),
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
    validate({ params: z.object({ transactionId: objectId }) }),
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
  validate(approveActionSchema),
  AdminController.approvePendingAction
);


//--- STAFF ADMIN MANAGEMENT (Super Admin ONLY) ---
router.get('/staff', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
AdminController.getStaffMembers);

router.post('/staff', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
validate(createStaffSchema),
AdminController.createStaffAdmin);

router.patch('/staff/:id', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
validate(updateStaffSchema),
AdminController.updateStaffAdmin);

router.delete('/staff/:id', authorizeAdmin([UserRole.SUPER_ADMIN]), 
enforceCapability(Permission.MANAGE_STAFF),
requireSudo,
validate(deleteStaffSchema),
AdminController.deleteStaff);

router.post('/users/:id/terminate-sessions', authenticateHardened, 
    hydrateIdentity, enforceCapability(Permission.MANAGE_STAFF), 
    requireSudo, 
    validate(terminateSessionsSchema),
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
router.post('/partners', authorizeAdmin([UserRole.SUPER_ADMIN]), enforceCapability(Permission.ONBOARD_PARTNERS), validate(createPartnerSchema), AdminImportController.createPartner);
router.get('/imports/unassigned', authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), enforceCapability(Permission.INTERVENE_IMPORTS), AdminImportController.getUnassignedImports);
router.patch('/imports/:requestId/assign', authorizeAdmin([UserRole.SUPER_ADMIN, UserRole.OPS_ADMIN]), enforceCapability(Permission.INTERVENE_IMPORTS), validate(assignPartnersSchema), AdminImportController.assignPartners);
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
  validate(updateSettingSchema),
  AdminController.updateSystemSetting
);


const createDraftSchema = {
  body: z.object({
    targetRole: z.enum(['customer', 'driver', 'partner', 'all']),
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(5000)
  })
};

const executeDraftSchema = {
  params: z.object({ id: objectId })
};

// STAGED BROADCASTS
router.post('/broadcast/draft', 
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  validate(createDraftSchema),
  AdminNotificationController.createDraft
);
router.post('/broadcast/:id/execute', 
  enforceCapability(Permission.SYSTEM_SETTINGS), 
  authorizeAdmin([UserRole.SUPER_ADMIN]),
  validate(executeDraftSchema),
  AdminNotificationController.execute
);

export default router;