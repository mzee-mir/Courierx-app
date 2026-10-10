import { Schema, model, Document, Types } from 'mongoose';

export type OfferStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'SEEN'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface IOrderOffer extends Document {
  orderId: Types.ObjectId;
  driverId: Types.ObjectId;
  roundNumber: number; // 1, 2, or 3
  status: OfferStatus;
  score: number;
  scoreBreakdown: {
    etaMinutes: number;
    etaScore: number;
    landmarkScore: number;
    headingScore: number;
    idleScore: number;
    acceptanceScore: number;
  };
  expiresAt: Date;
  respondedAt?: Date;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderOfferSchema = new Schema<IOrderOffer>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
    },
    status: {
      type: String,
      enum: ['SENT', 'DELIVERED', 'SEEN', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
      default: 'SENT',
      index: true,
    },
    score: {
      type: Number,
      required: true,
    },
    scoreBreakdown: {
      etaMinutes: { type: Number, required: true },
      etaScore: { type: Number, required: true },
      landmarkScore: { type: Number, required: true },
      headingScore: { type: Number, required: true },
      idleScore: { type: Number, required: true },
      acceptanceScore: { type: Number, required: true },
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    respondedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

// Compound unique index ensuring only one offer per driver per round for an order
OrderOfferSchema.index({ orderId: 1, driverId: 1, roundNumber: 1 }, { unique: true });

// Index for finding a driver's active offers quickly
OrderOfferSchema.index({ driverId: 1, status: 1 });

// Index for batch query of order offers by status
OrderOfferSchema.index({ orderId: 1, status: 1 });

export const OrderOffer = model<IOrderOffer>('OrderOffer', OrderOfferSchema);
