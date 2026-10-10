import { z } from 'zod';

/**
 * PATCH /driver/status
 * isAvailable is a boolean flag toggling duty status (ONLINE/OFFLINE).
 */
export const toggleStatusSchema = {
  body: z.object({
    isAvailable: z.boolean(),
  }),
};

/**
 * POST /driver/location
 * Coordinates must be a [lng, lat] number pair (valid GeoJSON position).
 * Longitude must be between -180 and 180, Latitude between -90 and 90.
 * Optional additional fields: heading (degrees 0-360), speed (km/h >= 0), connectivityState.
 */
export const updateLocationSchema = {
  body: z.object({
    coordinates: z.tuple([
      z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'),
      z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'),
    ]),
    heading: z.number().min(0, 'Heading must be >= 0').max(360, 'Heading must be <= 360').optional(),
    speed: z.number().min(0, 'Speed must be >= 0').optional(),
    connectivityState: z.enum(['ACTIVE', 'GRACE_PERIOD', 'STALE', 'OFFLINE']).optional(),
  }),
};
