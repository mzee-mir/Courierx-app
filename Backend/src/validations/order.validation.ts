import { z } from 'zod';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';

const pointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([
    z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
    z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
  ]),
});

const orderIdParam = z.object({ id: z.string().min(1) });

export const createOrderSchema = {
  body: z.object({
    pickupLocation: pointSchema,
    pickupLandmark: z.string().min(1).max(200),
    pickupLandmarkId: z.string().optional(),
    pickupCoordinates: z.tuple([z.number(), z.number()]).optional(),
    dropoffLocation: pointSchema,
    dropoffLandmark: z.string().min(1).max(200),
    dropoffLandmarkId: z.string().optional(),
    dropoffCoordinates: z.tuple([z.number(), z.number()]).optional(),
    vehicleType: z.enum([
      VehicleType.BAJAJ,
      VehicleType.CAR,
      VehicleType.TRUCK,
    ]),
    // Security: distanceKm is server-computed and NEVER accepted from the client.
    // Any client-supplied value is stripped by Zod's default behavior.
  }),
};

/**
 * PATCH /orders/:id/accept
 * version (Mongoose __v) is the optimistic-concurrency token: when present,
 * stale acceptances are rejected (409) instead of silently overwriting a newer
 * state. It is OPTIONAL because the current driver app rejects jobs without a
 * body; the controller only applies the __v guard when a version is supplied.
 */
export const acceptOrderSchema = {
  params: orderIdParam,
  body: z.object({
    version: z.number().int().min(0).optional(),
  }),
};

/**
 * PATCH /orders/:id/status
 * nextStatus must be a valid OrderStatus value. version is the optimistic-
 * concurrency token (Mongoose __v) but is OPTIONAL so the current driver app's
 * `{ nextStatus }` payload is accepted; when present the controller enforces
 * the version check (409 on stale data). DELIVERED is intentionally rejected in
 * the controller (money movement happens only through the PIN-gated /verify
 * endpoint).
 */
export const updateOrderStatusSchema = {
  params: orderIdParam,
  body: z.object({
    nextStatus: z.enum([
      OrderStatus.PENDING,
      OrderStatus.ACCEPTED,
      OrderStatus.ARRIVED_AT_PICKUP,
      OrderStatus.PICKED_UP,
      OrderStatus.ARRIVED_AT_DROPOFF,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
    ]),
    version: z.number().int().min(0).optional(),
  }),
};

/**
 * POST /orders/:id/verify
 * The delivery PIN is always a 4-digit numeric string.
 */
export const verifyOrderSchema = {
  params: orderIdParam,
  body: z.object({
    verificationPin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  }),
};
