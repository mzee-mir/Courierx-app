import { Request, Response } from 'express';
import { Wallet } from '../models/Wallet';
import mongoose from 'mongoose';
import { simulateEvcPayment } from '../services/evcServices';
import { Transaction } from '../models/Transaction';

export const getBalance = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    let wallet = await Wallet.findOne({ userId });
    
    if (!wallet) {
      wallet = await Wallet.create({ userId, balance: 0, tokenBalance: 0, currency: 'USD' });
    }

    res.status(200).json({ balance: wallet.balance, currency: wallet.currency });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch wallet' });
  }
};

export const depositFunds = async (req: Request, res: Response) => {
  const { amount, phoneNumber } = req.body;
  const userId = req.user?.userId;

  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  // 1. Calculate Carrier Fee (Somali standard mock)
  const carrierFee = amount > 10 ? 0.25 : 0.10; 
  const totalCharge = amount + carrierFee;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) {
      const [created] = await Wallet.create([{ userId, balance: 0, currency: 'USD' }], { session });
      wallet = created;
    }

    // 2. Initialize PENDING transaction with an external reference (provider tracking id)
    const externalRes = await simulateEvcPayment(phoneNumber, amount);

    const transaction = await Transaction.create([{
      walletId: wallet._id,
      userId,
      type: 'deposit',
      amount,
      fee: carrierFee,
      currency: 'USD',
      status: 'pending', // Always start as pending to handle lag
      provider: 'EVCPLUS',
      externalReference: externalRes.transactionId
    }], { session });

    await session.commitTransaction();

    // 3. Return the transaction ID so the frontend can poll for status
    res.status(200).json({ 
      success: true, 
      transactionId: transaction[0]._id,
      status: 'pending',
      totalToPay: totalCharge
    });  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'System busy, try later' });
  } finally {
    session.endSession();
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20); // Show recent 20

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

/**
 * Pollable transaction status endpoint.
 * The wallet screen polls this to reflect pending/complete/failed deposit states.
 */
export const checkTransactionStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ error: 'NOT_FOUND' });

    // Security: only the transaction owner may poll it.
    if (tx.userId.toString() !== userId) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    res.status(200).json({ success: true, status: tx.status, transactionId: tx._id });
  } catch (error) {
    res.status(500).json({ error: 'STATUS_FETCH_FAILED' });
  }
};
