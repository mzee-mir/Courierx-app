import { Schema, model, Document, Types } from 'mongoose';

export interface ILedgerEntry extends Document {
  debitAccount: string;  // Account money leaves (can be UserID or InternalAccount)
  creditAccount: string; // Account money enters
  amount: number;
  currency: string;
  idempotencyKey: string;
  referenceId: Types.ObjectId; // Link to Order, Transaction, or AdminLog
  description: string;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>({
  debitAccount: { type: String, required: true, index: true },
  creditAccount: { type: String, required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: 'USD' },
  idempotencyKey: { type: String, required: true, unique: true },
  referenceId: { type: Schema.Types.ObjectId, required: true },
  description: { type: String, required: true }
}, { timestamps: true });

// Prevent updates/deletes in MongoDB layer
LedgerEntrySchema.pre('findOneAndUpdate', () => { throw new Error('IMMUTABILITY_VIOLATION: Ledger entries cannot be modified'); });
LedgerEntrySchema.pre('findOneAndDelete', () => { throw new Error('IMMUTABILITY_VIOLATION: Ledger entries cannot be deleted'); });

export const LedgerEntry = model<ILedgerEntry>('LedgerEntry', LedgerEntrySchema);