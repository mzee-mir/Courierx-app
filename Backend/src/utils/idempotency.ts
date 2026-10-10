import { ClientSession } from 'mongoose';
import { Idempotency } from '../models/Idempotency';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Shared idempotency primitives (M3).
 *
 * The global middleware (enforceIdempotency) guarantees every mutation carries an
 * `X-Idempotency-Key` header and exposes it as `req.idempotencyKey`. Controllers
 * must then:
 *   1. `readIdempotency(compoundKey)` at the top — return the stored responseBody
 *      on replay.
 *   2. `writeIdempotency(compoundKey, responseBody[, session])` after the work —
 *      inside the same Mongo session for transactional controllers, or after the
 *      work for simple fire-and-forget writes.
 *
 * Compound keys follow the established codebase pattern:
 * `user:${id}:order_create:${key}`, `driver:${id}:accept:${id}:${key}`, etc.
 */
export const readIdempotency = async (key: string) => {
  return Idempotency.findOne({ key });
};

export const writeIdempotency = async (key: string, responseBody: unknown, session?: ClientSession) => {
  await Idempotency.create([{
    key,
    responseBody,
    expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
  }], session ? { session } : undefined);
};
