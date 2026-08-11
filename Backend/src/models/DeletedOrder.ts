import { Schema, model, Document, Types } from 'mongoose';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';

export interface IDeletedOrder extends Document {
  originalOrderId: Types.ObjectId;
  customerId: Types.ObjectId;
  orderData: any; // Snapshot of the full order object
  audit: {
    deletedAt: Date;
    deletedBy: Types.ObjectId;
    reason: string;
  };
}

const DeletedOrderSchema = new Schema<IDeletedOrder>({
  originalOrderId: { type: Schema.Types.ObjectId, required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  orderData: { type: Object, required: true },
  audit: {
    deletedAt: { type: Date, default: Date.now },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, default: 'USER_INITIATED_DELETION' }
  }
}, { timestamps: true });

export const DeletedOrder = model<IDeletedOrder>('DeletedOrder', DeletedOrderSchema);