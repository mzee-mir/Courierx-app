import { Schema, model, Document, Types } from 'mongoose';
// ✅ FIX: Import the shared Enums
import { OrderStatus, VehicleType } from '../enums/OrderEnums';

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  driverId?: Types.ObjectId;
  pickupLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  pickupLandmark: string;
  dropoffLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  importShipmentId?: Types.ObjectId; // Link to ImportRequest if applicable
  isDisputed: boolean;      
  disputeNote?: string;
  dropoffLandmark: string;
  vehicleType: VehicleType; // ✅ FIX: Use the Enum type
  status: OrderStatus;      // ✅ FIX: Use the Enum type
  price: number;
  commission: number;
  verificationPin: string;
  paymentSettled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    pickupLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    pickupLandmark: { type: String, required: true },
    dropoffLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: { type: [Number], required: true },
    },
    dropoffLandmark: { type: String, required: true },
    vehicleType: {
      type: String,
      enum: Object.values(VehicleType), // ✅ FIX: Validate against Enum values
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus), // ✅ FIX: Validate against Enum values
      default: OrderStatus.PENDING,
      index: true,
    },
    importShipmentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'ImportRequest', 
      unique: true, // 👈 THE KEY: MongoDB will block duplicate local orders
      sparse: true 
    },
    isDisputed: { type: Boolean, default: false },
    disputeNote: { type: String },
    price: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0 },
    verificationPin: { type: String, required: true },
    paymentSettled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OrderSchema.index({ pickupLocation: '2dsphere' });
export const Order = model<IOrder>('Order', OrderSchema);