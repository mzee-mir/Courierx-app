import { Schema, model, Document, Types } from 'mongoose';

export interface ISlaAlert extends Document {
  importId: Types.ObjectId;
  externalTrackingNumber: string;
  status: string;
  daysOverdue: number;
  detectedAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SlaAlertSchema = new Schema<ISlaAlert>(
  {
    importId:               { type: Schema.Types.ObjectId, ref: 'ImportRequest', required: true, index: true },
    externalTrackingNumber: { type: String, required: true },
    status:                 { type: String, required: true },
    daysOverdue:            { type: Number, required: true, min: 0 },
    detectedAt:             { type: Date, default: Date.now },
    resolved:               { type: Boolean, default: false, index: true },
    resolvedAt:             { type: Date },
    resolvedBy:             { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Prevent duplicate alerts for the same shipment in the same status on the same day
SlaAlertSchema.index(
  { importId: 1, status: 1, detectedAt: 1 },
  {
    unique: true,
    partialFilterExpression: { resolved: false }
  }
);

export const SlaAlert = model<ISlaAlert>('SlaAlert', SlaAlertSchema);
