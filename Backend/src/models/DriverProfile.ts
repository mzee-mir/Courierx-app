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
    vehicleType: 'bajaj' | 'car' | 'van';
    plateNumber: string;
    plateImageUrl?: string;
    vehicleImageUrl?: string;
  };
  status: 'pending' | 'approved' | 'rejected';
}

const driverProfileSchema = new Schema<IDriverProfile>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String },
  imageUrl: { type: String },
  documents: {
    nationalIdUrl: { type: String },
    licenseUrl: { type: String },
  },
  vehicle: {
    vehicleType: { type: String, enum: ['bajaj', 'car', 'van'], required: true },
    plateNumber: { type: String, required: true },
    plateImageUrl: { type: String },
    vehicleImageUrl: { type: String },
  },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

export const DriverProfile = model<IDriverProfile>('DriverProfile', driverProfileSchema);