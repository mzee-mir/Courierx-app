import { model, Schema } from "mongoose";

const pendingActionSchema = new Schema({
  actionType: { type: String, required: true },
  payload: { type: Object, required: true },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  requestId: { type: String, required: true }
}, { timestamps: true });

export const PendingAction = model('PendingAction', pendingActionSchema);