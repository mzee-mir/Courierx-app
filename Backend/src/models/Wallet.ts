import { Schema, model, Document, Types } from 'mongoose';

export interface IWallet extends Document {
  userId: Types.ObjectId;
  balance: number;
  tokenBalance: number; // Added: CourierX Coins (CXC) token balance
  currency: string;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0, min: 0 }, // min: 0 prevents negative balances
  tokenBalance: { type: Number, default: 0, min: 0 }, // Added: min: 0 prevents negative balances
  currency: { type: String, default: 'CXC' }, // Updated default to CXC
}, { timestamps: true });

export const Wallet = model<IWallet>('Wallet', walletSchema);