import { model, Schema } from "mongoose";

const broadcastSchema = new Schema({
  targetRole: { type: String, required: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  impactCount: { type: Number, required: true },
  status: { type: String, enum: ['DRAFT', 'QUEUED', 'SENT', 'ABORTED'], default: 'DRAFT' },
  scheduledFor: { type: Date },
  executedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  requestId: { type: String, required: true }
}, { timestamps: true });

export const Broadcast = model('Broadcast', broadcastSchema);