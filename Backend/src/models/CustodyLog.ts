import { Schema, model, Document, Types } from 'mongoose';

export interface ICustodyLog extends Document {
  importId: Types.ObjectId;
  fromStatus: string;
  toStatus: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
  ipAddress?: string;
  deviceId?: string;
  previousHash?: string;
}

const CustodyLogSchema = new Schema<ICustodyLog>(
  {
    importId: { type: Schema.Types.ObjectId, ref: 'ImportRequest', required: true, index: true },
    fromStatus: { type: String, required: true },
    toStatus: { type: String, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now, immutable: true },
    ipAddress: { type: String },
    deviceId: { type: String },
    previousHash: { type: String }
  },
  {
    timestamps: false // We rely on changedAt being immutable
  }
);

// Prevent any update operations on this collection
CustodyLogSchema.pre('findOneAndUpdate', function (next) {
  next(new Error('CustodyLog collection is append-only. Updates are not allowed.'));
});

CustodyLogSchema.pre('updateOne', function (next) {
  next(new Error('CustodyLog collection is append-only. Updates are not allowed.'));
});

CustodyLogSchema.pre('updateMany', function (next) {
  next(new Error('CustodyLog collection is append-only. Updates are not allowed.'));
});

CustodyLogSchema.pre('deleteOne', function (next) {
  next(new Error('CustodyLog collection is append-only. Deletes are not allowed.'));
});

CustodyLogSchema.pre('deleteMany', function (next) {
  next(new Error('CustodyLog collection is append-only. Deletes are not allowed.'));
});

CustodyLogSchema.pre('findOneAndDelete', function (next) {
  next(new Error('CustodyLog collection is append-only. Deletes are not allowed.'));
});

export const CustodyLog = model<ICustodyLog>('CustodyLog', CustodyLogSchema);
