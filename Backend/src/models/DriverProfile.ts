import { Schema, model, Document, Types } from 'mongoose';

export interface IDriverProfile extends Document {
  userId: Types.ObjectId;
  fullName: string;
  email?: string;
  imageUrl?: string;
  documents: {
    nationalIdUrl?: string;
    licenseUrl?: string;
  };
  vehicle: {
    vehicleType: 'bajaj' | 'car' | 'van' | 'truck';
    plateNumber: string;
    plateImageUrl?: string;
    vehicleImageUrl?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  lastDutyToggleAt?: Date;
  totalOffersReceived: number;
  totalOffersAccepted: number;
  totalOffersRejected: number;
  createdAt: Date;
  updatedAt: Date;
}

const driverProfileSchema = new Schema<IDriverProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    fullName: { type: String, required: true },
    email: { type: String },
    imageUrl: { type: String },
    documents: {
      nationalIdUrl: { type: String },
      licenseUrl: { type: String },
    },
    vehicle: {
      vehicleType: { type: String, enum: ['bajaj', 'car', 'van', 'truck'], required: true },
      plateNumber: { type: String, required: true },
      plateImageUrl: { type: String },
      vehicleImageUrl: { type: String },
    },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    lastDutyToggleAt: { type: Date },
    totalOffersReceived: { type: Number, default: 0 },
    totalOffersAccepted: { type: Number, default: 0 },
    totalOffersRejected: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const DriverProfile = model<IDriverProfile>('DriverProfile', driverProfileSchema);