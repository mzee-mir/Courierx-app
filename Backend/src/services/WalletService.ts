import mongoose, { ClientSession, Types } from "mongoose";
import { Wallet } from "../models/Wallet";
import { LedgerEntry } from "../models/LedgerEntry";
import { InternalAccount } from "../config/accounts";

export class WalletService {
  /**
   * ATOMIC DOUBLE-ENTRY MOVE
   * Hardened to handle both string and ObjectId types for referenceId.
   */
  public static async transferFunds(data: {
    from: string | InternalAccount;
    to: string | InternalAccount;
    amount: number;
    referenceId: string | Types.ObjectId; // 👈 Fixed: Accept both
    requestId: string;
    idempotencyKey: string;
    description: string;
    session: ClientSession;
  }) {
    const { from, to, amount, referenceId, idempotencyKey, description, session } = data;

    // 1. Ledger entry is the immutable proof
    await LedgerEntry.create([{
      debitAccount: from,
      creditAccount: to,
      amount,
      idempotencyKey,
      requestId: data.requestId,
      referenceId: new mongoose.Types.ObjectId(referenceId),
      description
    }], { session });

    // 2. Debit Logic
    if (!Object.values(InternalAccount).includes(from as any)) {
      const debitWallet = await Wallet.findOneAndUpdate(
        { userId: from, balance: { $gte: amount } },
        { $inc: { balance: -amount } },
        { session, new: true }
      );
      if (!debitWallet) throw new Error('INSUFFICIENT_FUNDS_OR_WALLET_NOT_FOUND');
    }

    // 3. Credit Logic
    if (!Object.values(InternalAccount).includes(to as any)) {
      await Wallet.findOneAndUpdate(
        { userId: to },
        { $inc: { balance: amount } },
        { session, upsert: true }
      );
    }
    return true;
  }

  /**
   * FIX: recordEntry mapping
   * Maps the old 'recordEntry' call to the new double-entry 'transferFunds' logic.
   */
  public static async recordEntry(data: {
    userId: string;
    amount: number;
    type: string;
    metadata: any;
    session: ClientSession;
  }) {
    // A deposit moves money from the CASH_POOL to the USER
    await this.transferFunds({
      from: InternalAccount.SYSTEM_CASH_POOL,
      to: data.userId,
      amount: data.amount,
      requestId: data.metadata.requestId,
      referenceId: data.metadata.externalReference || new mongoose.Types.ObjectId(),
      idempotencyKey: `DEP:${data.metadata.externalReference}`,
      description: `EVC+ Deposit Confirmation`,
      session: data.session
    });

    const updatedWallet = await Wallet.findOne({ userId: data.userId }).session(data.session);
    return { newBalance: updatedWallet?.balance || 0 };
  }

  /**
   * Releases escrow back to the customer when an order is cancelled/deleted.
   * Idempotent: the ESCROW_REFUND:<orderId> ledger key guarantees a single refund.
   * Guarded: refuses to run once the order has been settled (paymentSettled).
   */
  public static async releaseEscrow(data: {
    order: any; // IOrder-like
    reason: string;
    requestId: string;
    session: ClientSession;
  }) {
    const { order, reason, requestId, session } = data;

    if (order.paymentSettled) {
      return { skipped: true, reason: 'ALREADY_SETTLED' };
    }

    await this.transferFunds({
      from: InternalAccount.SYSTEM_ESCROW,
      to: order.customerId.toString(),
      amount: order.price,
      referenceId: order._id,
      idempotencyKey: `ESCROW_REFUND:${order._id}`,
      description: `Escrow refund for cancelled order ${order._id}. Reason: ${reason}`,
      requestId,
      session
    });

    return { skipped: false };
  }
}
/**
pricing: any; // From ImportRequest.pricingSnapshot
shipmentId: string;
requestId: string;
session: ClientSession;
}) {
const { pricing, userId, partnerId, shipmentId, requestId, session } = data;

// 1. PARTNER SHARE MOVE (User -> Partner Wallet)
await this.transferFunds({
  from: userId,
  to: partnerId, // PartnerOrg's Virtual Account
  amount: pricing.partnerShare,
  referenceId: shipmentId,
  idempotencyKey: `PARTNER_PAY:${shipmentId}`,
  description: `Partner operational share for shipment ${shipmentId}`,
  requestId,
  session
});

// 2. COURIERX SHARE MOVE (User -> SYSTEM_REVENUE)
await this.transferFunds({
  from: userId,
  to: InternalAccount.SYSTEM_REVENUE,
  amount: pricing.systemShare,
  referenceId: shipmentId,
  idempotencyKey: `SYSTEM_FEE:${shipmentId}`,
  description: `CourierX system add-on for shipment ${shipmentId}`,
  requestId,
  session
});
}
} */