import { Schema, model, Document, Types } from 'mongoose';

export interface IPartnerMetrics extends Document {
  partnerId: Types.ObjectId;
  weekStartDate: Date;
  weekEndDate: Date;
  totalVolume: number;
  averageTransitTimeDays: {
    AIR: number;
    SEA: number;
  };
  weightDisputeRate: number; // percentage (0 - 100)
  packageLossRate: number;   // percentage (0 - 100)
  averageIntakeHours: number; // Hours from declaration to China Hub intake scan
  createdAt: Date;
  updatedAt: Date;
}

const PartnerMetricsSchema = new Schema<IPartnerMetrics>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', required: true, index: true },
    weekStartDate: { type: Date, required: true },
    weekEndDate: { type: Date, required: true },
    totalVolume: { type: Number, default: 0 },
    averageTransitTimeDays: {
      AIR: { type: Number, default: 0 },
      SEA: { type: Number, default: 0 }
    },
    weightDisputeRate: { type: Number, default: 0 },
    packageLossRate: { type: Number, default: 0 },
    averageIntakeHours: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

PartnerMetricsSchema.index({ partnerId: 1, weekStartDate: -1 }, { unique: true });

export const PartnerMetrics = model<IPartnerMetrics>('PartnerMetrics', PartnerMetricsSchema);
