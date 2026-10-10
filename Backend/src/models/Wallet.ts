import { Schema, model, Document, Types } from 'mongoose';

export interface IWallet extends Document {
  userId: Types.ObjectId;
  balance: number;
  tokenBalance: number; // CXC token balance. INERT until the CXC migration (Phase 10) — not read by any authoritative path.
  currency: string;
  updatedAt: Date;
}

const walletSchema = new Schema<IWallet>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  balance: { type: Number, default: 0, min: 0 }, // min: 0 prevents negative balances
  tokenBalance: { type: Number, default: 0, min: 0 }, // INERT — CXC field retained for backward compatibility
  currency: { type: String, default: 'USD' }, // balance is USD (authoritative); tokenBalance is CXC-inert
}, { timestamps: true });

export const Wallet = model<IWallet>('Wallet', walletSchema);