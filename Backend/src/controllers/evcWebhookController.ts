import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction';
import { WalletService } from '../services/WalletService';

/**
 * Verifies the EVC+ webhook signature.
 * Payload is signed with HMAC-SHA256 using a shared secret; the signature
 * is provided in the X-EVC-Signature header as hex of HMAC(rawBody, secret).
 */
export const verifySignature = (rawBody: Buffer, signature: string | undefined): boolean => {
  if (!signature) return false;
  const secret = process.env.EVC_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
};

/**
 * POST /api/v1/wallet/webhook/evc
 * Provider callback that completes a pending deposit and credits the wallet.
 * Idempotent: replaying the same externalReference is a safe no-op (200).
 */
export const evcWebhookHandler = async (req: Request, res: Response) => {
  try {
    const rawBody: Buffer = (req as any).rawBody || Buffer.alloc(0);
    if (!verifySignature(rawBody, req.headers['x-evc-signature'] as string)) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    }

    const { externalReference } = req.body as { externalReference?: string };
    if (!externalReference) {
      return res.status(400).json({ error: 'MISSING_EXTERNAL_REFERENCE' });
    }

    const session = await mongoose.startSession();
    try {
      let completed = false;
      await session.withTransaction(async () => {
        // Guard: only a pending transaction may be completed by the provider callback.
        const tx = await Transaction.findOne({
          externalReference,
          status: 'pending',
        }).session(session);

        if (!tx) {
          // Already completed (idempotent replay) or unknown reference.
          const existing = await Transaction.findOne({ externalReference }).session(session);
          if (existing) return; // replay → no-op
          throw new Error('TRANSACTION_NOT_FOUND');
        }

        // Atomic single credit: ledger entry keyed on DEP:<externalReference> prevents
        // double-credit even under concurrent callbacks.
        const result = await WalletService.recordEntry({
          userId: tx.userId.toString(),
          amount: tx.amount,
          type: 'deposit',
          metadata: { externalReference: tx.externalReference, requestId: req.id },
          session,
        });

        tx.status = 'completed';
        await tx.save({ session });
        completed = true;
      });

      return res.status(200).json({
        success: true,
        status: completed ? 'completed' : 'already_processed',
      });
    } catch (error: any) {
      if (error.message === 'TRANSACTION_NOT_FOUND') {
        return res.status(404).json({ error: 'TRANSACTION_NOT_FOUND' });
      }
      // Duplicate ledger key under concurrency → already credited → no-op success.
      if (error?.code === 11000) {
        return res.status(200).json({ success: true, status: 'already_processed' });
      }
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    res.status(500).json({ error: 'WEBHOOK_PROCESSING_FAILED' });
  }
};
