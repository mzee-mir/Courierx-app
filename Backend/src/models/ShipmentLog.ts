import { Schema, model, Document, Types } from 'mongoose';


export interface IShipmentLog extends Document {
  importRequestId: Types.ObjectId;
  actorId: Types.ObjectId; // Could be an Admin or a Partner User
  actorModel: 'User' | 'CargoPartner';
  oldStatus: string;
  newStatus: string;
  location?: string; // e.g., "Guangzhou Warehouse" or "Mogadishu Port"
  notes?: string;
  createdAt: Date;
}


const shipmentLogSchema = new Schema<IShipmentLog>({
  importRequestId: { type: Schema.Types.ObjectId, ref: 'ImportRequest', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, required: true },
  actorModel: { type: String, enum: ['User', 'CargoPartner'], required: true },
  oldStatus: { type: String },
  newStatus: { type: String, required: true },
  location: { type: String },
  notes: { type: String },
}, { timestamps: true });


export const ShipmentLog = model<IShipmentLog>('ShipmentLog', shipmentLogSchema);