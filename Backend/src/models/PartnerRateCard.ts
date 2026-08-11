import { Schema, model, Document, Types } from 'mongoose';


export interface IRateCard extends Document {
  partnerId: Types.ObjectId;
  airRate: number;        // USD per KG
  seaRate: number;        // USD per KG
  handlingFeeBase: number;
  fragileFee: number;
  platformCommissionPercent: number; // Hidden from partner
  tiers: {
    minWeight: number;
    maxWeight: number;
    rateOverride: number;
    mode: 'AIR' | 'SEA';
  }[];
  volumetricDivisor: number; // 5000 or 6000
  isActive: boolean;
  effectiveDate: Date;
}


const RateCardSchema = new Schema<IRateCard>({
  partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', required: true, index: true },
  airRate: { type: Number, required: true, min: 0 },
  seaRate: { type: Number, required: true, min: 0 },
  handlingFeeBase: { type: Number, default: 0 },
  fragileFee: { type: Number, default: 0 },
  platformCommissionPercent: { type: Number, default: 15, min: 0, max: 100 },
  tiers: [{
    minWeight: { type: Number, required: true },
    maxWeight: { type: Number, required: true },
    rateOverride: { type: Number, required: true },
    mode: { type: String, enum: ['AIR', 'SEA'], required: true }
  }],
  volumetricDivisor: { type: Number, default: 5000 },
  isActive: { type: Boolean, default: true, index: true },
  effectiveDate: { type: Date, default: Date.now }
}, { timestamps: true });


// Ensure only one active card per partner at any time
RateCardSchema.index({ partnerId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });


export const PartnerRateCard = model<IRateCard>('PartnerRateCard', RateCardSchema);
