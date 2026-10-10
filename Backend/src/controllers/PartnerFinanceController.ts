import { Request, Response } from 'express';
import { ImportRequest, ImportStatus } from '../models/ImportRequest';
import { Wallet } from '../models/Wallet';
import { LedgerEntry } from '../models/LedgerEntry';
import { Transaction } from '../models/Transaction';
import mongoose from 'mongoose';
import { WalletService } from '../services/WalletService';
import { InternalAccount } from '../config/accounts';

export class PartnerFinanceController {
  /**
   * Returns finance summary for a partner organization.
   * All monetary values are USD (`balance` is the authoritative field).
   */
  public static async getFinanceSummary(req: Request, res: Response) {
    try {
      const { partnerId } = req.user!;

      // 1. Settled USD balance (authoritative field)
      const wallet = await Wallet.findOne({ userId: partnerId });
      const availableBalance = wallet?.balance || 0;

      // 2. Pending escrow (USD) — not yet settled to the partner
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
      const pendingBalance = pendingItems[0]?.totalPendingUsd || 0;

      // 3. Recent ledger entries
      const history = await LedgerEntry.find({
        $or: [{ debitAccount: partnerId }, { creditAccount: partnerId }],
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      res.status(200).json({
        success: true,
        data: {
          availableBalance,
          pendingBalance,
          pendingCount: pendingItems[0]?.count || 0,
          history,
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'FINANCE_FETCH_FAILED' });
    }
  }

  /**
   * Partner requests withdrawal of USD balance.
   * Body: { amount: number }
   * Route is guarded by enforceCapability(Permission.PARTNER_FINANCE).
   * Atomic: debit guarded by balance check, ledger entry in-session, idempotency-keyed reference.
   */
  public static async requestWithdrawal(req: Request, res: Response) {
    const { amount } = req.body as { amount: number };
    const { partnerId } = req.user!;
    const idempotencyKey = req.idempotencyKey;
    const requestId = req.id;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'INVALID_AMOUNT' });
    }

    const session = await mongoose.startSession();
    try {
      let result: { newBalance: number; transactionId: mongoose.Types.ObjectId } | undefined;
      await session.withTransaction(async () => {
        // 1. ATOMIC DEBIT: single operation guards against overdraft under concurrency.
        const wallet = await Wallet.findOneAndUpdate(
          { userId: partnerId, balance: { $gte: amount } },
          { $inc: { balance: -amount } },
          { session, new: true }
        );
        if (!wallet) {
          throw new Error('INSUFFICIENT_FUNDS');
        }

        // 2. LEDGER ENTRY (double-entry): partner debit -> SYSTEM:CASH_POOL credit.
        const externalReference = `WITH:${idempotencyKey}`;
        await LedgerEntry.create([{
          debitAccount: partnerId,
          creditAccount: InternalAccount.SYSTEM_CASH_POOL,
          amount,
          idempotencyKey: externalReference,
          requestId,
          referenceId: wallet._id,
          description: `Partner ${partnerId} withdrawal of $${amount}`
        }], { session });

        // 3. TRANSACTION RECORD (for admin payout processing).
        const tx = await Transaction.create([{
          walletId: wallet._id,
          userId: partnerId,
          type: 'withdrawal',
          amount,
          currency: 'USD',
          status: 'pending',
          provider: 'PARTNER',
          externalReference,
        }], { session });

        result = { newBalance: wallet.balance, transactionId: tx[0]._id };
      });

      await session.commitTransaction();
      res.status(200).json({ success: true, ...(result || {}) });
    } catch (err: any) {
      await session.abortTransaction();
      if (err.message === 'INSUFFICIENT_FUNDS') {
        return res.status(400).json({ error: 'INSUFFICIENT_FUNDS' });
      }
      // Unique ledger/transaction key collision => duplicate idempotency-key replay.
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'DUPLICATE_REQUEST' });
      }
      res.status(500).json({ error: 'WITHDRAWAL_FAILED', detail: err?.message });
    } finally {
      session.endSession();
    }
  }
}