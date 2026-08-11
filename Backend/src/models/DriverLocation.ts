// models/DriverLocation.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface IDriverLocation extends Document {
  userId: Types.ObjectId;
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  isAvailable: boolean;
  lastUpdated: Date;
}

const DriverLocationSchema = new Schema<IDriverLocation>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
    },
  },
  isAvailable: {
    type: Boolean,
    default: false,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Primary index for finding nearby drivers (Step 3: Broadcasting logic)
DriverLocationSchema.index({ location: '2dsphere' }, { sparse: true });;

// TTL index to ensure we don't dispatch to drivers who haven't updated location in 5 minutes
// This handles the "Intermittent Internet" constraint by pruning stale data
DriverLocationSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 300 });

export const DriverLocation = model<IDriverLocation>('DriverLocation', DriverLocationSchema);