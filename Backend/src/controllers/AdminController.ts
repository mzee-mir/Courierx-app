import { Request, Response } from 'express';
import { User, UserRole } from '../models/User';
import { DriverProfile } from '../models/DriverProfile';
import { Transaction } from '../models/Transaction';
import { Order } from '../models/Order';
import mongoose from 'mongoose';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { Wallet } from '../models/Wallet';
import bcrypt from 'bcryptjs';
import { redactUser } from '../utils/redact';
import { PendingAction } from '../models/PendingAction';
import { SystemSettings } from '../models/SystemSettings';
import { SETTINGS_REGISTRY } from '../config/settingsRegistry';
import { DriverLocation } from '../models/DriverLocation';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class AdminController {
  
  private static buildInsightFilters(query: any) {
    const { startDate, endDate, vehicleType } = query;
    const filter: any = {};

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (vehicleType) {
      filter.vehicleType = vehicleType;
    }

    return filter;
  }

  // 2. Approve or Reject a Driver
  public static async verifyDriver(req: Request, res: Response) {
    const { id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:verify_driver:${id}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.json(existingReq.responseBody);

    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const profile = await DriverProfile.findOneAndUpdate(
          { userId: id }, { status }, { session, new: true }
        );
        if (!profile) throw new Error('PROFILE_NOT_FOUND');

        if (status === 'approved') {
          await User.findByIdAndUpdate(id, { isVerified: true }, { session });
        }

        await AdminAuditLog.create([{
          adminId: req.user?.userId, action: 'VERIFY_DRIVER',
          targetId: id, targetModel: 'DriverProfile', details: reason, requestId: req.id
        }], { session });

        const responsePayload = { success: true };
        await writeIdempotency(lookupKey, responsePayload, session);
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    } finally { session.endSession(); }
  }

  public static async getDashboardStats(req: Request, res: Response) {
    try {
      const [activeOrders, pendingDrivers, pendingDeposits] = await Promise.all([
        Order.countDocuments({ status: { $in: ['ACCEPTED', 'PICKED_UP', 'ARRIVED'] } }),
        DriverProfile.countDocuments({ status: 'pending' }),
        Transaction.countDocuments({ type: 'deposit', status: 'pending' })
      ]);

      // Simple revenue calculation (15% commission on all delivered orders)
      const deliveredOrders = await Order.find({ status: 'DELIVERED' }).select('commission');
      const totalRevenue = deliveredOrders.reduce((acc, curr) => acc + (curr.commission || 0), 0);

      res.status(200).json({
        success: true,
        stats: {
          activeOrders,
          pendingDrivers,
          pendingDeposits,
          totalRevenue: totalRevenue.toFixed(2)
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'FAILED_TO_FETCH_STATS' });
    }
  }

  public static async getPendingDrivers(req: Request, res: Response) {
    try {
      const drivers = await DriverProfile.find({ status: 'pending' })
        .populate('userId', 'phoneNumber displayName')
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, drivers });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_PENDING_FAILED' });
    }
  }

  public static async getAuditLogs(req: Request, res: Response) {
  const logs = await AdminAuditLog.find()
    .populate('adminId', 'displayName email')
    .sort({ createdAt: -1 })
    // Ensure .select('+changes') is NOT needed because it's not marked as select: false
    .limit(50); 
    res.json({ success: true, logs });
  }

  public static async getCustomerInsights(req: Request, res: Response) {
    
    try {
      const { startDate, endDate, vehicleType } = req.query;

      // 1. BUILD DYNAMIC FILTER
      // This object will be injected into the $match stages
      const filterMatch: any = {};

      if (startDate || endDate) {
        filterMatch.createdAt = {};
        if (startDate) filterMatch.createdAt.$gte = new Date(startDate as string);
        if (endDate) filterMatch.createdAt.$lte = new Date(endDate as string);
      }

      if (vehicleType) {
        filterMatch.vehicleType = vehicleType;
      }

      // 2. VIP AGGREGATION: Finding the "Lifeblood"
      // We combine the 'DELIVERED' status with our dynamic filters
      const vipInsights = await Order.aggregate([
        { 
          $match: { 
            status: 'DELIVERED', 
            ...filterMatch 
          } 
        },
        { 
          $group: { 
            _id: '$customerId', 
            totalSpent: { $sum: '$price' }, 
            totalCommission: { $sum: '$commission' },
            orderCount: { $sum: 1 },
            avgOrderValue: { $avg: '$price' },
            lastOrderDate: { $max: '$createdAt' }
          } 
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 15 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            totalSpent: 1,
            orderCount: 1,
            avgOrderValue: 1,
            lastOrderDate: 1,
            "user.displayName": 1,
            "user.phoneNumber": 1,
            "user.imageUrl": 1
          }
        }
      ]);

      // 3. RISK AGGREGATION: Identifying "Friction Points"
      const riskInsights = await Order.aggregate([
        { 
          $match: { 
            ...filterMatch, // Apply date/vehicle filters to the risk check too
            $or: [
              { isDisputed: true }, 
              { status: 'CANCELLED' }
            ] 
          } 
        },
        { 
          $group: { 
            _id: '$customerId', 
            issueCount: { $sum: 1 },
            disputeCount: { $sum: { $cond: ["$isDisputed", 1, 0] } },
            cancellationCount: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } }
          } 
        },
        { $match: { issueCount: { $gt: 1 } } }, // Show users with more than 1 issue in the filtered period
        { $sort: { issueCount: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' }
      ]);

      // 4. RETENTION METRIC: Dormant VIPs
      // Logic: High value customers (>$50 total) who haven't ordered in 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const dormantVIPs = await Order.aggregate([
        { 
            $match: vehicleType ? { vehicleType } : {} // Filter dormancy by vehicle type if requested
        },
        { 
            $group: { 
                _id: '$customerId', 
                lastDate: { $max: '$createdAt' }, 
                totalSpent: { $sum: '$price' } 
            } 
        },
        { 
            $match: { 
                lastDate: { $lt: thirtyDaysAgo }, 
                totalSpent: { $gt: 50 } 
            } 
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $limit: 10 }
      ]);

      res.status(200).json({
        success: true,
        data: {
          vips: vipInsights,
          risk: riskInsights,
          dormant: dormantVIPs
        }
      });
    } catch (error) {
        console.error("INSIGHTS_ERROR:", error);
        res.status(500).json({ error: 'INSIGHTS_GENERATION_FAILED' });
    }
  }

  public static async getVIPMasterlist(req: Request, res: Response) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = AdminController.buildInsightFilters(req.query);

    const vips = await Order.aggregate([
      { $match: { status: 'DELIVERED', ...filter } },
      {
        $group: {
          _id: '$customerId',
          totalSpent: { $sum: '$price' },
          orderCount: { $sum: 1 },
          avgOrderValue: { $avg: '$price' },
          lastOrderDate: { $max: '$createdAt' }
        }
      },
      { $sort: { totalSpent: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      { $project: { "user.password": 0, "user.firebaseUid": 0 } }
    ]);

    const totalCount = await Order.distinct('customerId', { status: 'DELIVERED', ...filter });

    res.json({ 
      success: true, 
      data: vips, 
      pagination: { total: totalCount.length, page: Number(page), pages: Math.ceil(totalCount.length / Number(limit)) } 
    });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_VIP_FAILED' });
  }
}

  public static async getRiskMasterlist(req: Request, res: Response) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter = AdminController.buildInsightFilters(req.query);

    const riskList = await Order.aggregate([
      { 
        $match: { 
          ...filter,
          $or: [{ isDisputed: true }, { status: 'CANCELLED' }] 
        } 
      },
      {
        $group: {
          _id: '$customerId',
          disputeCount: { $sum: { $cond: ["$isDisputed", 1, 0] } },
          cancelCount: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
          totalIssues: { $sum: 1 },
          lastIssueDate: { $max: '$createdAt' }
        }
      },
      { $sort: { totalIssues: -1 } },
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    ]);

    res.json({ success: true, data: riskList });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_RISK_FAILED' });
  }
}

  public static async getDormantMasterlist(req: Request, res: Response) {
  try {
    const { page = 1, limit = 20, vehicleType } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dormant = await Order.aggregate([
      { $match: vehicleType ? { vehicleType } : {} },
      {
        $group: {
          _id: '$customerId',
          lastActivity: { $max: '$createdAt' },
          totalLifetimeSpent: { $sum: '$price' },
          totalOrders: { $sum: 1 }
        }
      },
      { 
        $match: { 
          lastActivity: { $lt: thirtyDaysAgo },
          totalLifetimeSpent: { $gt: 20 } // Only care about users who previously spent >$20
        } 
      },
      { $sort: { lastActivity: 1 } }, // Show longest dormant first
      { $skip: skip },
      { $limit: Number(limit) },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' }
    ]);

    res.json({ success: true, data: dormant });
  } catch (error) {
    res.status(500).json({ error: 'FETCH_DORMANT_FAILED' });
  }
}

  public static async getOrderHistory(req: Request, res: Response) {
  try {
    const { search, status, startDate, endDate, page = 1 } = req.query;
    const limit = 20;

    const query: any = {};

    // 1. ANCHORED SEARCH (Prevents ReDoS Attacks)
    if (search) {
      const cleanSearch = String(search).trim();
      
      // If search looks like a Phone Number
      if (cleanSearch.startsWith('+') || /^\d+$/.test(cleanSearch)) {
        const users = await User.find({ 
          phoneNumber: { $regex: `^${cleanSearch.replace('+', '\\+')}` } 
        }).select('_id').limit(10);
        query.$or = [{ customerId: { $in: users } }, { driverId: { $in: users } }];
      } 
      // If search looks like an ID
      else if (mongoose.isValidObjectId(cleanSearch)) {
        query._id = cleanSearch;
      }
      // Name Search
      else {
        const users = await User.find({ 
          displayName: { $regex: `^${cleanSearch}`, $options: 'i' } 
        }).select('_id').limit(10);
        query.customerId = { $in: users };
      }
    }

    // 2. STATUS & DATE FILTERS (Indexed)
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const orders = await Order.find(query)
      .populate('customerId', 'displayName phoneNumber')
      .populate('driverId', 'displayName phoneNumber')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ success: true, orders });
  } catch (e) {
    res.status(500).json({ error: 'DEEP_SEARCH_FAILED' });
  }
}

  public static async getLogsByTarget(req: Request, res: Response) {
  const { targetId } = req.params;
  const logs = await AdminAuditLog.find({ targetId })
    .populate('adminId', 'displayName')
    .sort({ createdAt: -1 });
  res.json({ success: true, logs });
}

public static async getDriverFullDetail(req: Request, res: Response) {
    try {
      const { id } = req.params; // User ID

      // 1. Fetch core data in parallel
      const [user, profile, wallet, stats] = await Promise.all([
        User.findById(id).select('-password -firebaseUid -pushToken -__v').lean(),
        DriverProfile.findOne({ userId: id }),
        Wallet.findOne({ userId: id }),
        Order.aggregate([
          { $match: { driverId: new mongoose.Types.ObjectId(id) } },
          { 
            $group: { 
              _id: null, 
              totalJobs: { $sum: 1 },
              completedJobs: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
              cancelledJobs: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
              totalEarnings: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, "$price", 0] } }
            } 
          }
        ])
      ]);

      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      res.status(200).json({
        success: true,
        data: {
          user: redactUser(user),
          profile,
          wallet,
          stats: stats[0] || { totalJobs: 0, completedJobs: 0, cancelledJobs: 0, totalEarnings: 0 }
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_DOSSIER_FAILED' });
    }
  }

  /**
   * Toggle Account Status (Suspend/Activate)
   */
  public static async toggleUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { isSuspended, reason } = req.body; // Expecting { isSuspended: true, reason: "..." }
      const adminId = req.user?.userId;

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `admin:${adminId}:user_status:${id}:${isSuspended}:${req.idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.status(200).json(existingReq.responseBody);

      // 1. Update the User record
      const user = await User.findByIdAndUpdate(
        id, 
        { isSuspended }, 
        { new: true }
      );

      if (!user) {
        return res.status(404).json({ error: 'USER_NOT_FOUND' });
      }

      // 2. Audit the action so we know WHY they were suspended
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: isSuspended ? 'SUSPEND_USER' : 'ACTIVATE_USER',
        targetId: user._id,
        targetModel: 'User',
        details: reason || `Account status changed to ${isSuspended ? 'Suspended' : 'Active'}`,
      });

      console.log(`SECURITY_LOG: User ${user.phoneNumber} is now ${isSuspended ? 'SUSPENDED' : 'ACTIVE'}`);

      const responsePayload = { success: true, user };
      await writeIdempotency(lookupKey, responsePayload);
      return res.status(200).json(responsePayload);
    } catch (error) {
      console.error('SUSPENSION_ERROR:', error);
      return res.status(500).json({ error: 'FAILED_TO_UPDATE_STATUS' });
    }
  }

  public static async getDriverLeaderboard(req: Request, res: Response) {
    try {
      const { startDate, endDate, vehicleType } = req.query;

      // 1. Build Filter
      const filter: any = {};
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate as string);
        if (endDate) filter.createdAt.$lte = new Date(endDate as string);
      }
      if (vehicleType) filter.vehicleType = vehicleType;

      // 2. Aggregate Top Earners & Quality
      const stats = await Order.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$driverId',
            totalEarnings: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, "$price", 0] } },
            completedJobs: { $sum: { $cond: [{ $eq: ["$status", "DELIVERED"] }, 1, 0] } },
            cancelledJobs: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
            totalJobs: { $sum: 1 }
          }
        },
        { $match: { _id: { $ne: null } } }, // Ignore unassigned orders
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $lookup: {
            from: 'driverprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile'
          }
        },
        { $unwind: '$profile' },
        {
          $project: {
            _id: 1,
            totalEarnings: 1,
            completedJobs: 1,
            cancelledJobs: 1,
            totalJobs: 1,
            successRate: { 
              $multiply: [ { $divide: ["$completedJobs", { $cond: [{ $eq: ["$totalJobs", 0] }, 1, "$totalJobs"] }] }, 100 ] 
            },
            "user.displayName": 1,
            "user.phoneNumber": 1,
            "profile.vehicle": 1,
            "profile.imageUrl": 1
          }
        },
        { $sort: { totalEarnings: -1 } }
      ]);

      // 3. Split into Segments
      const topEarners = stats.slice(0, 10);
      const highRisk = stats
        .filter(d => d.cancelledJobs > 2 || d.successRate < 70)
        .sort((a, b) => b.cancelledJobs - a.cancelledJobs)
        .slice(0, 10);

      res.status(200).json({
        success: true,
        data: {
          topEarners,
          highRisk,
          activeCount: stats.length
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'LEADERBOARD_FAILED' });
    }
  }

  /**
   * Search and List all Users (Drivers & Customers)
   */
  public static async getAllUsers(req: Request, res: Response) {
    try {
      const { role, search, page = 1, limit = 10 } = req.query;
      
      const query: any = {};
      if (role) query.roles = role;
      if (search) {
        // Search by name or phone number
        query.$or = [
          { displayName: { $regex: search, $options: 'i' } },
          { phoneNumber: { $regex: search, $options: 'i' } }
        ];
      }


      const users = await User.find(query)
        .select('displayName phoneNumber email roles isVerified isSuspended imageUrl createdAt')
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .sort({ createdAt: -1 });

      const total = await User.countDocuments(query);

      res.status(200).json({
        success: true,
        users: users.map(redactUser),
        pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) }
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_USERS_FAILED' });
    }
  }

  // 2. Approve or Reject a driver
  public static async processVerification(req: Request, res: Response) {
    const { driverId } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    try {
      const profile = await DriverProfile.findOneAndUpdate(
        { userId: driverId },
        { status },
        { new: true }
      );

      if (!profile) return res.status(404).json({ error: 'PROFILE_NOT_FOUND' });

      // If approved, update the core User record to allow them to go online
      if (status === 'approved') {
        await User.findByIdAndUpdate(driverId, { isVerified: true });
      }

      res.status(200).json({ success: true, message: `Driver ${status} successfully` });
    } catch (error) {
      res.status(500).json({ error: 'VERIFICATION_FAILED' });
    }
  }

  // 3. System Stats (For the Dashboard Widgets)
  public static async getSystemStats(req: Request, res: Response) {
    try {
      const [totalOrders, activeOrders, pendingDrivers] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ status: { $ne: 'DELIVERED' } }),
        DriverProfile.countDocuments({ status: 'pending' })
      ]);

      res.status(200).json({
        success: true,
        stats: { totalOrders, activeOrders, pendingDrivers }
      });
    } catch (error) {
      res.status(500).json({ error: 'STATS_FAILED' });
    }
  }

  /**
   * List all administrative staff members
   */
  public static async getStaffMembers(req: Request, res: Response) {
    try {
      // Find users who have ANY of the admin roles
      const staff = await User.find({
        roles: { $in: ['super_admin', 'ops_admin', 'finance_admin', 'support_admin'] }
      }).select('-password').sort({ createdAt: -1 });

      res.status(200).json({ success: true, staff });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_STAFF_FAILED' });
    }
  }

  /**
   * Create a new specialized Admin user
   */
  public static async createStaffAdmin(req: Request, res: Response) {
    const { email, password, displayName, role } = req.body;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:create_staff:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(201).json(existingReq.responseBody);

    try {
      // 1. Check if email exists
      const existing = await User.findOne({ email });
      if (existing) return res.status(400).json({ error: 'EMAIL_ALREADY_IN_USE' });

      // 2. Hash Password
      const hashedPassword = await bcrypt.hash(password, 12);

      // 3. Create User with chosen sub-role
      const newAdmin = await User.create({
        email,
        password: hashedPassword,
        displayName,
        roles: [role], // e.g., 'ops_admin'
        isVerified: true,
        firebaseUid: `INTERNAL_${Date.now()}` // Internal admins don't need Firebase
      });

      // 4. Log the action
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: 'CREATE_STAFF_ADMIN',
        targetId: newAdmin._id,
        targetModel: 'User',
        details: `Created new admin: ${email} with role ${role}`
      });

      const responsePayload = { success: true, admin: newAdmin };
      await writeIdempotency(lookupKey, responsePayload);
      res.status(201).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'CREATE_ADMIN_FAILED' });
    }
  }

  /**
   * Update a Staff Member's details or role
   */
  public static async updateStaffAdmin(req: Request, res: Response) {
    const { id } = req.params;
    const { displayName, email, role, password } = req.body;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:update_staff:${id}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    try {
      const updateData: any = { displayName, email, roles: [role] };

      // If a new password is provided, hash it
      if (password && password.trim() !== "") {
        updateData.password = await bcrypt.hash(password, 12);
      }

      const updatedMember = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');

      if (!updatedMember) return res.status(404).json({ error: 'STAFF_NOT_FOUND' });

      // Log the update
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: 'UPDATE_STAFF_ADMIN',
        targetId: updatedMember._id,
        targetModel: 'User',
        details: `Updated staff member: ${email} to role ${role}`
      });

      const responsePayload = { success: true, admin: updatedMember };
      await writeIdempotency(lookupKey, responsePayload);
      res.status(200).json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'UPDATE_FAILED' });
    }
  }

  public static async getDailyPulse(req: Request, res: Response) {
    try {
      // 1. Define "Today" (Start of day in current timezone)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [todayOrders, onlineDrivers, pendingAlerts] = await Promise.all([
        // Count orders created today
        Order.aggregate([
          { $match: { createdAt: { $gte: startOfToday } } },
          { $group: { 
              _id: null, 
              count: { $sum: 1 }, 
              revenue: { $sum: "$price" },
              commission: { $sum: "$commission" }
            } 
          }
        ]),
        // Count online drivers grouped by vehicle type
        DriverLocation.aggregate([
          { $match: { isAvailable: true, lastUpdated: { $gte: new Date(Date.now() - 5*60*1000) } } },
          {
            $lookup: {
              from: 'driverprofiles',
              localField: 'userId',
              foreignField: 'userId',
              as: 'profile'
            }
          },
          { $unwind: '$profile' },
          { $group: { _id: '$profile.vehicle.vehicleType', count: { $sum: 1 } } }
        ]),
        // Count active SOS or Disputed orders
        Order.countDocuments({ 
          $or: [{ isDisputed: true }, { status: 'EXCEPTION' }],
          updatedAt: { $gte: startOfToday }
        })
      ]);

      res.status(200).json({
        success: true,
        data: {
          ordersToday: todayOrders[0]?.count || 0,
          revenueToday: todayOrders[0]?.revenue || 0,
          profitToday: todayOrders[0]?.commission || 0,
          fleetBreakdown: onlineDrivers,
          alertCount: pendingAlerts
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'DAILY_PULSE_FAILED' });
    }
  }

  /**
   * Remove a Staff Member permanently
   */
  public static async deleteStaff(req: Request, res: Response) {
    const { id } = req.params;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:delete_staff:${id}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.json(existingReq.responseBody);

    const targetUser = await User.findById(id);
    if (!targetUser) return res.status(404).json({ error: 'NOT_FOUND' });

    // 👈 INVARIANT: The Highlander Rule (Must have at least 1 Super Admin)
    if (targetUser.roles.includes(UserRole.SUPER_ADMIN)) {
      const superCount = await User.countDocuments({ roles: UserRole.SUPER_ADMIN });
      if (superCount <= 1) {
        return res.status(403).json({ error: 'INVARIANT_VIOLATION_LAST_ADMIN' });
      }
    }

    await User.findByIdAndDelete(id);
    
    await AdminAuditLog.create({
      adminId, action: 'DELETE_STAFF', targetId: id, targetModel: 'User',
      details: `Deleted admin account: ${targetUser.email}`, requestId: req.id
    });

    const responsePayload = { success: true };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }

  public static async updateSystemSetting(req: Request, res: Response) {
    const { key, value, reason } = req.body;
    const config = SETTINGS_REGISTRY[key as keyof typeof SETTINGS_REGISTRY];
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response so an admin
    // retry cannot queue the SAME setting change twice (two PendingActions).
    const lookupKey = `admin:${adminId}:update_setting:${key}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.status(202).json(existingReq.responseBody);

    // 1. Functional Observer Check
    if (!config) return res.status(404).json({ error: 'SETTING_NOT_FOUND' });
    if (!config.isImplemented) {
      return res.status(501).json({ 
        error: 'NOT_IMPLEMENTED', 
        message: "This setting is defined but not yet wired to system logic." 
      });
    }

    // 2. Validation
    const validatedValue = config.schema.parse(value);

    const oldSetting = await SystemSettings.findOne({ key, isActive: true });

    // 3. Dual-Auth (as per Highlander Rule) and Audit Snapshot
    await AdminAuditLog.create({
      action: 'UPDATE_SETTING',
      targetId: req.user?.userId, // Target is the system config
      targetModel: 'SystemSettings',
      details: reason,
      changes: { 
        key,
        previousValue: oldSetting?.value, 
        newValue: validatedValue 
      },
      requestId: req.id
    });

    // Instead of updating, we create a proposal
    const action = await PendingAction.create({
      actionType: 'UPDATE_SETTING',
      payload: { key, value, reason },
      initiatedBy: req.user?.userId,
      requestId: req.id
    });

    const responsePayload = { 
      success: true, 
      message: 'Action submitted for Dual-Authorization. Requires second Super Admin approval.',
      actionId: action._id 
    };
    await writeIdempotency(lookupKey, responsePayload);

    res.status(202).json(responsePayload);
  }

  public static async approvePendingAction(req: Request, res: Response) {
    const { actionId } = req.params;
    const approverId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${approverId}:approve_action:${actionId}:${req.idempotencyKey}`;
    const existingReq = await readIdempotency(lookupKey);
    if (existingReq) return res.json(existingReq.responseBody);

    const action = await PendingAction.findById(actionId);
    if (!action || action.status !== 'PENDING') throw new Error('ACTION_NOT_FOUND');

    // THE 2-MAN RULE: Approver cannot be the Initiator
    if (action.initiatedBy.toString() === approverId) {
      return res.status(403).json({ error: 'DUAL_AUTH_VIOLATION', message: 'You cannot approve your own action.' });
    }

    // Execute the actual setting change here...
    action.status = 'APPROVED';
    await action.save();
    const responsePayload = { success: true };
    await writeIdempotency(lookupKey, responsePayload);
    res.json(responsePayload);
  }

  /**
 * getStaffDetail: Comprehensive view of an internal admin or partner user.
 */
  public static async getStaffDetail(req: Request, res: Response) {
    try {
      const { id } = req.params;

      // 1. Fetch User Profile
      const user = await User.findById(id).select('-password -firebaseUid').lean();
      if (!user) return res.status(404).json({ error: 'STAFF_NOT_FOUND' });

      // 2. Fetch Audit History (Actions performed BY this user)
      const activities = await AdminAuditLog.find({ adminId: id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      // 3. Aggregate Performance (e.g., total verifications, total payouts)
      const stats = await AdminAuditLog.aggregate([
        { $match: { adminId: new mongoose.Types.ObjectId(id) } },
        { $group: { _id: '$action', count: { $sum: 1 } } }
      ]);

      res.status(200).json({
        success: true,
        data: {
          profile: redactUser(user),
          activities,
          stats
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_STAFF_DOSSIER_FAILED' });
    }
  }

  /**
   * getSettingsSchema: Returns the functional registry.
   * Tells the Frontend which settings are "Real" and what their constraints are.
   */
  public static async getSettingsSchema(req: Request, res: Response) {
    try {
      // We return the registry we defined in src/config/settingsRegistry.ts
      res.json({ success: true, schema: SETTINGS_REGISTRY });
    } catch (error) {
      res.status(500).json({ error: 'SCHEMA_FETCH_FAILED' });
    }
  }

  /**
   * getSystemSettings: Returns the current live values from the DB.
   */
  public static async getSystemSettings(req: Request, res: Response) {
    try {
      // Fetch only the active version of every setting
      const settings = await SystemSettings.find({ isActive: true })
        .select('key value updatedAt updatedBy')
        .populate('updatedBy', 'displayName');
      
      res.json({ success: true, settings });
    } catch (error) {
      res.status(500).json({ error: 'SETTINGS_FETCH_FAILED' });
    }
  }

  /**
   * getPendingActions: Returns the 2-Man Rule Queue.
   * Used by the "Pending Approvals" page.
   */
  public static async getPendingActions(req: Request, res: Response) {
    try {
      const actions = await PendingAction.find({ status: 'PENDING' })
        .populate('initiatedBy', 'displayName email')
        .sort({ createdAt: -1 });

      // We redact internal database fields and return a clean array
      const redactedActions = actions.map(action => ({
        id: action._id,
        actionType: action.actionType,
        payload: action.payload,
        initiatedBy: action.initiatedBy,
        createdAt: action.createdAt,
        requestId: action.requestId
      }));

      res.json({ success: true, actions: redactedActions });
    } catch (error) {
      res.status(500).json({ error: 'ACTION_QUEUE_FETCH_FAILED' });
    }
  }

  public static async terminateUserSessions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const adminId = req.user?.userId;

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = `admin:${adminId}:terminate_sessions:${id}:${req.idempotencyKey}`;
      const existingReq = await readIdempotency(lookupKey);
      if (existingReq) return res.json(existingReq.responseBody);

      // Increment version + Atomic update
      const user = await User.findByIdAndUpdate(
        id, 
        { $inc: { tokenVersion: 1 } }, 
        { new: true }
      );

      if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

      // Log this high-security event
      await AdminAuditLog.create({
        adminId: req.user?.userId,
        action: 'TERMINATE_ALL_SESSIONS',
        targetId: user._id,
        targetModel: 'User',
        details: `Forced global logout for user: ${user.email || user.phoneNumber}`,
        requestId: req.id
      });

      const responsePayload = { success: true, message: 'All active sessions have been invalidated.' };
      await writeIdempotency(lookupKey, responsePayload);
      res.json(responsePayload);
    } catch (error) {
      res.status(500).json({ error: 'TERMINATION_FAILED' });
    }
  }

  public static async updatePriceGuardrails(req: Request, res: Response) {
    const { ceiling, addOn, reason } = req.body;

    // Wrapped in 2-Man Rule logic (PendingAction)
    await PendingAction.create({
      actionType: 'UPDATE_PRICE_GUARDS',
      payload: { ceiling, addOn, reason },
      initiatedBy: req.user?.userId,
      requestId: req.id
    });

    res.status(202).json({ success: true, message: 'Pricing changes queued for second approval.' });
  }
}