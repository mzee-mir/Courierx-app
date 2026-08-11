import { Schema, model, Document, Types } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminId: Types.ObjectId;
  action: string;      // e.g., 'CONFIRM_DEPOSIT', 'VERIFY_DRIVER', 'ADJUST_WALLET'
  targetId: Types.ObjectId; // The ID of the User, Order, or Transaction affected
  targetModel: string; // 'User', 'Order', 'Transaction'
  details: string;     // Human-readable description
  changes?: any;       // Snapshot of what changed (e.g., { oldBalance: 0, newBalance: 50 })
  ipAddress?: string;
  requestId?: string;  // To correlate with specific admin requests
  createdAt: Date;
}

const auditLogSchema = new Schema<IAdminAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  requestId: { type: String, required: true, index: true },
  targetId: { type: Schema.Types.ObjectId, required: true },
  targetModel: { type: String, required: true },
  details: { type: String, required: true },
  changes: { type: Object },
  ipAddress: { type: String },
}, { timestamps: true });

const blockMutation = function(this: any, next: any) {
  next(new Error('IMMUTABILITY_VIOLATION: Audit logs cannot be modified or deleted.'));
};

auditLogSchema.pre('updateOne', blockMutation);
auditLogSchema.pre('findOneAndUpdate', blockMutation);
auditLogSchema.pre('findOneAndDelete', blockMutation);
auditLogSchema.pre('deleteOne', blockMutation);
auditLogSchema.pre('deleteMany', blockMutation);

export const AdminAuditLog = model<IAdminAuditLog>('AdminAuditLog', auditLogSchema);