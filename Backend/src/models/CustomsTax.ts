import { Schema, model, Document } from 'mongoose';

export interface ICustomsTax extends Document {
  hsCode: string;
  category: string;
  dutyPercentage: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomsTaxSchema = new Schema<ICustomsTax>({
  hsCode: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true },
  dutyPercentage: { type: Number, required: true, min: 0, max: 100 },
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

export const CustomsTax = model<ICustomsTax>('CustomsTax', CustomsTaxSchema);
