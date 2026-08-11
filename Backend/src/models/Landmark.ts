// models/Landmark.ts
import { Schema, model, Document, Types } from 'mongoose';

export interface ILandmark extends Document {
  userId: Types.ObjectId;
  label: string; // e.g., "Abti's Pharmacy"
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  description: string; // e.g., "Opposite the blue mosque, red gate"
  isDefault: boolean;
  createdAt: Date;
}

const LandmarkSchema = new Schema<ILandmark>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    description: {
      type: String,
      required: true,
      maxlength: 200,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Enable spatial queries on landmarks
LandmarkSchema.index({ location: '2dsphere' });

export const Landmark = model<ILandmark>('Landmark', LandmarkSchema);