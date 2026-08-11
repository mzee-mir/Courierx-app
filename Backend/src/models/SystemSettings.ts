import { Schema, model, Document } from 'mongoose';

export interface ISystemSettings extends Document {
  key: string; // e.g., 'PRICING_BAJAJ_PER_KM'
  value: any;
  description: string;
  updatedBy: Schema.Types.ObjectId;
}

const settingsSchema = new Schema({
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  version: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  changeReason: { type: String, required: true }
});

settingsSchema.index({ key: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

export const SystemSettings = model<ISystemSettings>('SystemSettings', settingsSchema);