// models/CargoPartner.ts
import { Schema, model, Document } from 'mongoose';

export interface IWarehouse {
  country: string;
  city: string;
  fullAddress: string;
  contactNumber: string;
}

export interface ICargoPartner extends Document {
  name: string;
  logoUrl?: string;
  baseRatePerKg: number; // In USD
  estimatedTransitDays: number;
  warehouses: IWarehouse[];
  isActive: boolean;
  supportedRoutes: string[]; // e.g., ["China-Somalia", "Dubai-Somalia"]
  createdAt: Date;
}

const WarehouseSchema = new Schema<IWarehouse>({
  country: { type: String, required: true },
  city: { type: String, required: true },
  fullAddress: { type: String, required: true },
  contactNumber: { type: String, required: true },
});

const CargoPartnerSchema = new Schema<ICargoPartner>(
  {
    name: { type: String, required: true, unique: true },
    logoUrl: { type: String },
    baseRatePerKg: { type: Number, required: true, min: 0 },
    estimatedTransitDays: { type: Number, required: true },
    warehouses: [WarehouseSchema],
    isActive: { type: Boolean, default: true, index: true },
    supportedRoutes: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

export const CargoPartner = model<ICargoPartner>('CargoPartner', CargoPartnerSchema);