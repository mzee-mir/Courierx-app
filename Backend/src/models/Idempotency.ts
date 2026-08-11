import mongoose, { Schema } from "mongoose";

// New Model for Request Tracking
const idempotencySchema = new Schema({
  key: { type: String, required: true, unique: true }, // Format: adminId:action:nonce
  responseBody: { type: Object, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } } // TTL Index
}, { timestamps: true });

export const Idempotency = mongoose.model('Idempotency', idempotencySchema);