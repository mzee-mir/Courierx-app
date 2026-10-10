import { Request, Response } from 'express';
import { Transaction } from '../models/Transaction';
import { Wallet } from '../models/Wallet';
import { AdminAuditLog } from '../models/AdminAuditLog';
import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Idempotency } from '../models/Idempotency';
import { WalletService } from '../services/WalletService';
import { InternalAccount } from '../config/accounts';

export class AdminFinanceController {
  
  /**
   * Fetches all EVC+ deposits that are waiting for admin confirmation.
   */
  public static async getPendingDeposits(req: Request, res: Response) {
    try {
      const pending = await Transaction.find({ 
        type: 'deposit', 
        status: 'pending' 
      }).populate('userId', 'phoneNumber displayName')
        .sort({ createdAt: -1 });

      res.status(200).json({ success: true, count: pending.length, transactions: pending });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_FINANCE_DATA_FAILED' });
    }
  }

  /**
   * Atomic Operation: Confirms real money was received and updates the wallet.
   */
  public static async confirmDeposit(req: Request, res: Response) {
    const { transactionId } = req.params;
    const adminId = req.user?.userId;
    const key = req.idempotencyKey; // From middleware

    // 1. Idempotency Check using the enforced header key
    const lookupKey = `admin:${adminId}:confirm:${key}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const tx = await Transaction.findById(transactionId).session(session);
        if (!tx || tx.status !== 'pending') throw new Error('TX_ALREADY_PROCESSED');

        // Use the restored recordEntry (now backed by double-entry ledger)
        const result = await WalletService.recordEntry({
          userId: tx.userId.toString(),
          amount: tx.amount,
          type: 'deposit',
          metadata: { externalReference: tx.externalReference, requestId: req.id },
          session
        });

        tx.status = 'completed';
        await tx.save({ session });

        const responsePayload = { success: true, newBalance: result.newBalance };
        
        await Idempotency.create([{
          key: lookupKey,
          responseBody: responsePayload,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }], { session });

        res.status(200).json(responsePayload);
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    } finally {
      session.endSession();
    }
  }

  /**
   * Manual Balance Adjustment (The "Fix-it" tool)
   */
  public static async adjustWallet(req: Request, res: Response) {
    const { userId, amount, reason } = req.body;
    const adminId = req.user?.userId;
    const idempotencyKey = req.idempotencyKey; // From Global Middleware
    const requestId = req.id; // From Global Middleware

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // 1. Create Immutable Audit Log (Step 1 of the move)
        const [auditLog] = await AdminAuditLog.create([{
          adminId,
          action: 'MANUAL_WALLET_ADJUST',
          targetId: new mongoose.Types.ObjectId(userId),
          targetModel: 'User',
          details: reason,
          requestId, // Link to the API request
          ipAddress: req.ip
        }], { session });

        // 2. Execute Ledger Transfer
        // If amount > 0: SYSTEM -> USER. If amount < 0: USER -> SYSTEM.
        await WalletService.transferFunds({
          from: amount > 0 ? InternalAccount.SYSTEM_ADJUSTMENTS : userId,
          to: amount > 0 ? userId : InternalAccount.SYSTEM_ADJUSTMENTS,
          amount: Math.abs(amount),
          referenceId: auditLog._id,
          idempotencyKey: `ADJ:${idempotencyKey}`, // Compound key
          description: `Manual adjustment by admin. Reason: ${reason}`,
          requestId, // Pass down for ledger traceability
          session
        });

        res.status(200).json({ 
          success: true, 
          message: 'LEDGER_ADJUSTMENT_SUCCESSFUL',
          traceId: requestId 
        });
      });
    } catch (error: any) {
      console.error(`[FinanceError][${requestId}]`, error);
      res.status(400).json({ 
        error: 'TRANSACTION_FAILED', 
        message: 'The ledger could not be settled.' 
      });
    } finally {
      session.endSession();
    }
  }

  /**
   * Fetch all drivers waiting to cash out their earnings
   */
  public static async getPendingWithdrawals(req: Request, res: Response) {
    try {
      const withdrawals = await Transaction.find({ 
        type: 'withdrawal', 
        status: 'pending' 
      })
      .populate('userId', 'phoneNumber displayName')
      .sort({ createdAt: -1 });

      res.status(200).json({ success: true, withdrawals });
    } catch (error) {
      res.status(500).json({ error: 'FETCH_WITHDRAWALS_FAILED' });
    }
  }

  public static async getRevenueStats(req: Request, res: Response) {
      try {
        const { startDate, endDate } = req.query;
        const filter: any = { status: 'DELIVERED' };
  
        if (startDate || endDate) {
          filter.createdAt = {};
          if (startDate) filter.createdAt.$gte = new Date(startDate as string);
          if (endDate) filter.createdAt.$lte = new Date(endDate as string);
        }
  
        // 1. Calculate Grand Totals
        const totals = await Order.aggregate([
          { $match: filter },
          { 
            $group: { 
              _id: null, 
              grossVolume: { $sum: '$price' }, 
              netCommission: { $sum: '$commission' },
              orderCount: { $sum: 1 }
            } 
          }
        ]);
  
        // 2. Revenue Breakdown by Vehicle Type
        const vehicleBreakdown = await Order.aggregate([
          { $match: filter },
          { 
            $group: { 
              _id: '$vehicleType', 
              revenue: { $sum: '$price' }, 
              commission: { $sum: '$commission' },
              count: { $sum: 1 }
            } 
          }
        ]);
  
        // 3. Daily Revenue Trend (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const dailyTrend = await Order.aggregate([
          { $match: { status: 'DELIVERED', createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              dailyCommission: { $sum: "$commission" },
              dailyOrders: { $sum: 1 }
            }
          },
          { $sort: { "_id": 1 } }
        ]);
  
        res.status(200).json({
          success: true,
          data: {
            summary: totals[0] || { grossVolume: 0, netCommission: 0, orderCount: 0 },
            byVehicle: vehicleBreakdown,
            trend: dailyTrend
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'REVENUE_CALCULATION_FAILED' });
      }
    }

  /**
   * ATOMIC: Marks a withdrawal as paid and logs the admin action
   */
  public static async completeWithdrawal(req: Request, res: Response) {
    const { transactionId } = req.params;
    const adminId = req.user?.userId;

    // M3: Idempotency lookup — replay returns the stored response.
    const lookupKey = `admin:${adminId}:complete_withdrawal:${transactionId}:${req.idempotencyKey}`;
    const existingReq = await Idempotency.findOne({ key: lookupKey });
    if (existingReq) return res.status(200).json(existingReq.responseBody);

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const tx = await Transaction.findById(transactionId).session(session);
      if (!tx || tx.status !== 'pending') throw new Error('INVALID_TRANSACTION');

      // 1. Mark Transaction as Completed
      tx.status = 'completed';
      await tx.save({ session });

      // 2. Log for Audit
      await AdminAuditLog.create([{
        adminId,
        action: 'PROCESS_WITHDRAWAL',
        targetId: tx.userId,
        targetModel: 'User',
        details: `Processed $${tx.amount} payout to EVC+ number linked to user.`,
      }], { session });

      const responsePayload = { success: true, message: 'PAYOUT_RECORDS_UPDATED' };

      await Idempotency.create([{
        key: lookupKey,
        responseBody: responsePayload,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }], { session });

      await session.commitTransaction();
      res.status(200).json(responsePayload);
    } catch (error: any) {
      await session.abortTransaction();
      res.status(500).json({ error: error.message || 'PAYOUT_FAILED' });
    } finally {
      session.endSession();
    }
  }
}