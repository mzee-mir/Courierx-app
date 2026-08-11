import { Schema, model, Document } from 'mongoose';

export interface IPartnerOrganization extends Document {
  name: string;
  status: 'ACTIVE' | 'LIMITED' | 'SUSPENDED';
  operatingCountries: string[]; // e.g., ['CN', 'SO']
  availableModes: {
    air: boolean;
    sea: boolean;
  };
  airConfig: {
    avgTransitDays: number;
    maxWeightPerPackage: number;
  };
  seaConfig: {
    avgTransitDays: number;
    minCBM: number;
  };
  publicProfile: {
    bio: string;
    logoUrl: string;
    contactPhone: string;
    whatsappNumber: string;
    chinaAddress: string; // The copy-paste string for Alibaba
    markingInstructions: string; // e.g. "Name / CX-Code"
    prohibitedItems: string[];
    operatingHours: string;
  };
  ratingStats: {
    averageRating: number;
    totalReviews: number;
  };
  requestedAirRate: number; // Partner's price/kg
  requestedSeaRate: number; // Partner's price/kg
  dailyIntakeTarget: number;
  domesticConfig: {
    ratePerKg: number; // e.g., $1.00 extra per KG
    enabled: boolean;
  };
  createdAt: Date;

}

const partnerOrgSchema = new Schema<IPartnerOrganization>({
  name: { type: String, required: true, unique: true },
  status: { type: String, enum: ['ACTIVE', 'LIMITED', 'SUSPENDED'], default: 'ACTIVE', index: true },
  availableModes: {
    air: { type: Boolean, default: true },
    sea: { type: Boolean, default: false }
  },
  airConfig: {
    avgTransitDays: { type: Number, default: 7 },
    maxWeightPerPackage: { type: Number, default: 30 } // Safety for air handlers
  },
  dailyIntakeTarget: { type: Number, default: 100 },
  seaConfig: {
    avgTransitDays: { type: Number, default: 45 },
    minCBM: { type: Number, default: 0.1 } // Minimum chargeable volume
  },
  domesticConfig: {
    ratePerKg: { type: Number, default: 1.00 }, // e.g., $1.00 extra per KG
    enabled: { type: Boolean, default: true }
  },
  publicProfile: {
    bio: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    whatsappNumber: { type: String, default: "" },
    chinaAddress: { type: String, default: "" },
    markingInstructions: { type: String, default: "Customer Name / CX-CODE" },
    prohibitedItems: [{ type: String }],
    operatingHours: { type: String, default: "Sat - Thu: 8am - 5pm" }
  },
  ratingStats: {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 }
  },
  requestedAirRate: { type: Number, default: 8.00 }, // Partner's price/kg
  requestedSeaRate: { type: Number, default: 2.00 }, // Partner's price/kg
  operatingCountries: [{ type: String, required: true }]
}, { timestamps: true });

export const PartnerOrganization = model<IPartnerOrganization>('PartnerOrganization', partnerOrgSchema);