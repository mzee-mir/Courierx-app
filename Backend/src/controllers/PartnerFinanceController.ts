import { Request, Response } from 'express';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { Wallet } from '../models/Wallet';
import { LedgerEntry } from '../models/LedgerEntry';
import { Transaction } from '../models/Transaction';
import mongoose from 'mongoose';
import { TokenExchangeService } from '../services/TokenExchangeService';

export class PartnerFinanceController {
  /**
   * Returns finance summary for a partner organization using CXC token balances.
   */
  public static async getFinanceSummary(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;

      // 1. Settled token balance
      const wallet = await Wallet.findOne({ userId: partnerId });
      const availableTokenBalance = wallet?.tokenBalance || 0;

      // 2. Pending escrow (USD) converted to tokens
      const pendingItems = await ImportRequest.aggregate([
        {
          $match: {
            partnerId: new mongoose.Types.ObjectId(partnerId as string),
            status: {
              $in: [
                ImportStatus.RECEIVED_AT_ORIGIN,
                ImportStatus.CONSOLIDATED,
                ImportStatus.IN_TRANSIT,
                ImportStatus.ARRIVED_LOCAL,
                ImportStatus.READY_FOR_LOCAL_HANDOFF,
                ImportStatus.HANDED_OFF,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPendingUsd: { $sum: "$pricingSnapshot.partnerShare" },
            count: { $sum: 1 },
          },
        },
      ]);
      const pendingUsd = pendingItems[0]?.totalPendingUsd || 0;
      const pendingTokenBalance = TokenExchangeService.convertUsdToCxc(pendingUsd);

      // 3. Recent ledger entries (still USD based, keep as‑is)
      const history = await LedgerEntry.find({
        $or: [{ debitAccount: partnerId }, { creditAccount: partnerId }],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          availableTokenBalance,
          pendingTokenBalance,
          pendingCount: pendingItems[0]?.count || 0,
          history,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'FINANCE_FETCH_FAILED' });
    }
  }

  /**
   * Partner requests withdrawal of CXC tokens.
   * Body: { amount: number }
   */
  public static async requestWithdrawal(req: Request, res: Response) {
    const { amount } = req.body as { amount: number };
    const { partnerId } = req.user!;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const wallet = await Wallet.findOne({ userId: partnerId }).session(session);
      if (!wallet || (wallet.tokenBalance ?? 0) < amount) {
        throw new Error('INSUFFICIENT_TOKENS');
      }
      // Deduct tokens
      await Wallet.updateOne({ userId: partnerId }, { $inc: { tokenBalance: -amount } }, { session });
      // Record transaction
      await Transaction.create(
        [
          {
            walletId: wallet._id,
            userId: partnerId,
            type: 'withdrawal',
            amount,
            currency: 'CXC',
            status: 'completed',
            provider: 'PARTNER',
            externalReference: `withdraw-${Date.now()}`,
          },
        ],
        { session }
      );
      await session.commitTransaction();
      res.status(200).json({ success: true, newBalance: wallet.tokenBalance - amount });
    } catch (err) {
      await session.abortTransaction();
      res.status(500).json({ error: 'WITHDRAWAL_FAILED', detail: (err as Error).message });
    } finally {
      session.endSession();
    }
  }
}