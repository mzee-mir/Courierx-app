import { Schema, model, Document, Types } from 'mongoose';


export enum ManifestStatus {
  DRAFT = 'DRAFT',
  CONSOLIDATED = 'CONSOLIDATED', // Manifest is full/closed
  DEPARTED = 'DEPARTED',         // En route to Somalia
  ARRIVED = 'ARRIVED',           // At Port/Warehouse
  DISMANTLED = 'DISMANTLED'      // Individual shipments released
}


export interface IManifest extends Document {
  manifestCode: string; // e.g. MAN-2026-001
  originHub: Types.ObjectId;
  destinationHub: Types.ObjectId;
  shippingMode: 'AIR' | 'SEA';
  status: ManifestStatus;
  shipmentIds: Types.ObjectId[];
  partnerId?: Types.ObjectId;
  metadata: {
    containerNumber?: string;
    vesselName?: string;
    estimatedArrival: Date;
  };
  createdAt: Date;
  upDatedAt: Date;
}


const ManifestSchema = new Schema<IManifest>({
  manifestCode: { type: String, required: true, unique: true },
  originHub: { type: Schema.Types.ObjectId, ref: 'PartnerLocation', required: true },
  destinationHub: { type: Schema.Types.ObjectId, ref: 'PartnerLocation', required: true },
  shippingMode: { type: String, enum: ['AIR', 'SEA'], required: true },
  status: { type: String, enum: Object.values(ManifestStatus), default: ManifestStatus.DRAFT },
  shipmentIds: [{ type: Schema.Types.ObjectId, ref: 'ImportRequest' }],
  partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', index: true },
  metadata: {
    containerNumber: String,
    vesselName: String,
    estimatedArrival: Date
  }
}, { timestamps: true });


export const Manifest = model<IManifest>('Manifest', ManifestSchema);
