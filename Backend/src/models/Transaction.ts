import { Schema, model, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  walletId: Types.ObjectId;
  userId: Types.ObjectId;
  type: 'deposit' | 'withdrawal' | 'payment' | 'commission';
  amount: number;
  currency: 'USD' | 'CXC'; // Added: Support for USD and CXC currencies
  status: 'pending' | 'completed' | 'failed';
  provider: string;
  externalReference: string;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>({
  walletId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['deposit', 'withdrawal', 'payment', 'commission'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, enum: ['USD', 'CXC'], default: 'USD' }, // Added: Default USD for backwards compatibility
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  provider: { type: String, default: 'EVCPLUS' },
  externalReference: { type: String, required: true, unique: true },
}, { timestamps: true });

transactionSchema.index({ provider: 1, externalReference: 1 }, { unique: true });

export const Transaction = model<ITransaction>('Transaction', transactionSchema);