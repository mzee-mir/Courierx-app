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
      wallet = await Wallet.create({ userId, balance: 0, tokenBalance: 0, currency: 'CXC' });
    }

    res.status(200).json({ balance: wallet.tokenBalance, currency: wallet.currency });
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
    const { Wallet } = require('../models/Wallet');
    const { Transaction } = require('../models/Transaction');
    const { simulateEvcPayment } = require('../services/evcService');

    let wallet = await Wallet.findOne({ userId }).session(session);
    if (!wallet) wallet = await Wallet.create([{ userId, balance: 0 }], { session });

    // 2. Initialize PENDING transaction
    const externalRes = await simulateEvcPayment(phoneNumber, amount);
    
    const transaction = await Transaction.create([{
      walletId: wallet._id || wallet[0]._id,
      userId,
      type: 'deposit',
      amount,
      fee: carrierFee, // Ensure your Transaction model has this field
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
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ error: 'System busy, try later' });
  } finally {
    session.endSession();
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { Transaction } = require('../models/Transaction');

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20); // Show recent 20

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
};

export const checkTransactionStatus = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { Transaction, Wallet } = require('../models/Transaction');

    const tx = await Transaction.findById(id);
    if (!tx) return res.status(404).json({ error: 'Not found' });

    // In a real system, you'd check the Telco Callback here.
    // For MVP, we simulate a status change after 5 seconds.
    res.status(200).json({ success: true, status: tx.status });
};