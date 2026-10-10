import { Schema, model, Document } from 'mongoose';

export interface ISystemLandmark extends Document {
  name: string;
  officialName: string;
  aliases: string[];
  category: 'hotel' | 'market' | 'hospital' | 'government' | 'port' | string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  polygonZone?: {
    type: 'Polygon';
    coordinates: [number, number][][];
  };
  verifiedEntryPoints: {
    label: string;
    coordinates: [number, number]; // [lng, lat]
  }[];
  totalDeliveries: number;
  confidenceScore: number;
  positiveConfirmations: number;
  negativeConfirmations: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SystemLandmarkSchema = new Schema<ISystemLandmark>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    officialName: {
      type: String,
      required: true,
      trim: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    category: {
      type: String,
      enum: ['hotel', 'market', 'hospital', 'government', 'port'],
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val: number[]) {
            return (
              Array.isArray(val) &&
              val.length === 2 &&
              typeof val[0] === 'number' &&
              typeof val[1] === 'number' &&
              !isNaN(val[0]) &&
              !isNaN(val[1]) &&
              val[0] >= -180 &&
              val[0] <= 180 &&
              val[1] >= -90 &&
              val[1] <= 90
            );
          },
          message: 'Coordinates must be valid [longitude (-180..180), latitude (-90..90)]',
        },
      },
    },
    polygonZone: {
      type: {
        type: String,
        enum: ['Polygon'],
      },
      coordinates: {
        type: [[[Number]]],
      },
    },
    verifiedEntryPoints: [
      {
        label: { type: String, required: true, trim: true },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator: function (val: number[]) {
              return (
                Array.isArray(val) &&
                val.length === 2 &&
                typeof val[0] === 'number' &&
                typeof val[1] === 'number' &&
                !isNaN(val[0]) &&
                !isNaN(val[1]) &&
                val[0] >= -180 &&
                val[0] <= 180 &&
                val[1] >= -90 &&
                val[1] <= 90
              );
            },
            message: 'Entry point coordinates must be valid [longitude (-180..180), latitude (-90..90)]',
          },
        },
      },
    ],
    totalDeliveries: {
      type: Number,
      default: 0,
      min: 0,
    },
    confidenceScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    positiveConfirmations: {
      type: Number,
      default: 0,
      min: 0,
    },
    negativeConfirmations: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// GeoJSON 2dsphere index on location
SystemLandmarkSchema.index({ location: '2dsphere' });

// Index for fast lookup by name & aliases
SystemLandmarkSchema.index({ name: 1 });
SystemLandmarkSchema.index({ aliases: 1 });

// Index for active status queries
SystemLandmarkSchema.index({ isActive: 1 });

export const SystemLandmark = model<ISystemLandmark>('SystemLandmark', SystemLandmarkSchema);
