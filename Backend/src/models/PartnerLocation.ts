import { Schema, model, Document, Types } from 'mongoose';

export interface IPartnerLocation extends Document {
  partnerId: Types.ObjectId;
  name: string; // e.g., "Guangzhou East Hub"
  type: 'WAREHOUSE' | 'PORT' | 'TRANSIT_HUB';
  country: string; // 'CN' or 'SO'
  city: string;
  address: string;
}

const partnerLocationSchema = new Schema<IPartnerLocation>({
  partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, enum: ['WAREHOUSE', 'PORT', 'TRANSIT_HUB'], required: true },
  country: { type: String, required: true, index: true },
  city: { type: String, required: true },
  address: { type: String, required: true }
});

export const PartnerLocation = model<IPartnerLocation>('PartnerLocation', partnerLocationSchema);