import { Schema, model, Document, Types } from 'mongoose';

export interface IDriverLandmarkStat extends Document {
  driverId: Types.ObjectId; // ref User
  systemLandmarkId: Types.ObjectId; // ref SystemLandmark
  completedDeliveries: number;
  lastDeliveredAt: Date;
}

const DriverLandmarkStatSchema = new Schema<IDriverLandmarkStat>({
  driverId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  systemLandmarkId: {
    type: Schema.Types.ObjectId,
    ref: 'SystemLandmark',
    required: true,
  },
  completedDeliveries: {
    type: Number,
    default: 0,
  },
  lastDeliveredAt: {
    type: Date,
    default: Date.now,
  },
});



// Compound unique index to prevent duplicate stats for same driver+landmark
DriverLandmarkStatSchema.index({ driverId: 1, systemLandmarkId: 1 }, { unique: true });

export const DriverLandmarkStat = model<IDriverLandmarkStat>('DriverLandmarkStat', DriverLandmarkStatSchema);
