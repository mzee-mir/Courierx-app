import { Schema, model, Document, Types } from 'mongoose';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';

export interface IOrder extends Document {
  customerId: Types.ObjectId;
  driverId?: Types.ObjectId;
  pickupLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  pickupCoordinates?: [number, number]; // Virtual access to authoritative GPS coordinates
  pickupLandmark: string;
  pickupLandmarkId?: Types.ObjectId;    // Optional reference to CourierX SystemLandmark
  dropoffLocation: {
    type: 'Point';
    coordinates: [number, number];
  };
  dropoffCoordinates?: [number, number]; // Virtual access to authoritative GPS coordinates
  dropoffLandmark: string;
  dropoffLandmarkId?: Types.ObjectId;   // Optional reference to CourierX SystemLandmark
  importShipmentId?: Types.ObjectId;    // Link to ImportRequest if applicable
  isDisputed: boolean;      
  disputeNote?: string;
  vehicleType: VehicleType;
  status: OrderStatus;
  dispatchRound?: number;
  dispatchStatus?: 'IDLE' | 'DISPATCHING' | 'MATCHED' | 'EXHAUSTED';
  dispatchExhaustedAt?: Date;
  isChained?: boolean;
  chainedAssignedAt?: Date;
  price: number;
  commission: number;
  verificationPin: string;
  paymentSettled: boolean;
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    driverId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    pickupLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val: number[]) {
            return Array.isArray(val) && val.length === 2;
          },
          message: 'Pickup coordinates must be [longitude, latitude]',
        },
      },
    },
    pickupLandmark: { type: String, required: true },
    pickupLandmarkId: {
      type: Schema.Types.ObjectId,
      ref: 'SystemLandmark',
      index: true,
      sparse: true,
    },
    dropoffLocation: {
      type: { type: String, enum: ['Point'], required: true },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val: number[]) {
            return Array.isArray(val) && val.length === 2;
          },
          message: 'Dropoff coordinates must be [longitude, latitude]',
        },
      },
    },
    dropoffLandmark: { type: String, required: true },
    dropoffLandmarkId: {
      type: Schema.Types.ObjectId,
      ref: 'SystemLandmark',
      index: true,
      sparse: true,
    },
    vehicleType: {
      type: String,
      enum: Object.values(VehicleType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    dispatchRound: {
      type: Number,
      default: 1,
    },
    dispatchStatus: {
      type: String,
      enum: ['IDLE', 'DISPATCHING', 'MATCHED', 'EXHAUSTED'],
      default: 'IDLE',
      index: true,
    },
    dispatchExhaustedAt: {
      type: Date,
    },
    isChained: {
      type: Boolean,
      default: false,
    },
    chainedAssignedAt: {
      type: Date,
    },
    importShipmentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'ImportRequest', 
      unique: true,
      sparse: true 
    },
    isDisputed: { type: Boolean, default: false },
    disputeNote: { type: String },
    price: { type: Number, required: true, min: 0 },
    commission: { type: Number, required: true, min: 0 },
    verificationPin: { type: String, required: true, select: false },
    paymentSettled: { type: Boolean, default: false },
    settledAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual getters for clean direct access to coordinates
OrderSchema.virtual('pickupCoordinates').get(function (this: IOrder) {
  return this.pickupLocation?.coordinates;
});

OrderSchema.virtual('dropoffCoordinates').get(function (this: IOrder) {
  return this.dropoffLocation?.coordinates;
});

OrderSchema.index({ pickupLocation: '2dsphere' });
OrderSchema.index({ driverId: 1, status: 1 });

export const Order = model<IOrder>('Order', OrderSchema);