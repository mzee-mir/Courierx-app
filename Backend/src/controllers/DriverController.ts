import { Request, Response } from 'express';
import { DriverLocation } from '../models/DriverLocation';
import { DriverProfile } from '../models/DriverProfile';
import mongoose from 'mongoose';
import { DispatchService } from '../services/DispatchService';
import { GeoTrackingService } from '../services/GeoTrackingService';
import { readIdempotency, writeIdempotency } from '../utils/idempotency';

export class DriverController {
  public static async toggleStatus(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      const { isAvailable } = req.body;
      const idempotencyKey = req.idempotencyKey;

      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      // M3: Idempotency lookup — replay returns the stored response.
      const lookupKey = idempotencyKey ? `driver:${userId}:toggle_status:${idempotencyKey}` : null;
      if (lookupKey) {
        const existingReq = await readIdempotency(lookupKey);
        if (existingReq) return res.status(200).json(existingReq.responseBody);
      }

      console.log(`SYSTEM_ACTION: User ${userId} going ${isAvailable ? 'ONLINE' : 'OFFLINE'}`);

      const now = new Date();
      await Promise.all([
        DriverLocation.findOneAndUpdate(
          { userId: new mongoose.Types.ObjectId(userId) },
          { 
            $set: { 
              isAvailable, 
              lastUpdated: now,
              lastHeartbeatAt: now,
              connectivityState: isAvailable ? 'ACTIVE' : 'OFFLINE',
            } 
          },
          { 
            upsert: true, 
            new: true,
            runValidators: false,
            setDefaultsOnInsert: false
          }
        ),
        DriverProfile.updateOne(
          { userId: new mongoose.Types.ObjectId(userId) },
          { $set: { lastDutyToggleAt: now } }
        )
      ]);

      const responsePayload = { success: true, status: isAvailable ? 'ONLINE' : 'OFFLINE' };

      // Phase 3: Sync Redis Geo layer on toggle
      if (!isAvailable) {
        try {
          await GeoTrackingService.removeDriver(userId);
          await GeoTrackingService.forceMongoSync(userId);
        } catch (err: any) {
          console.warn('[DriverController] Redis toggle sync warn:', err.message);
          // Non-fatal — MongoDB was already updated above
        }
      }

      if (lookupKey) {
        await writeIdempotency(lookupKey, responsePayload);
      }
      return res.status(200).json(responsePayload);
    } catch (error: any) {
      console.error('DATABASE_ERROR_TOGGLE_STATUS:', error.message);
      return res.status(400).json({ error: 'STATUS_TOGGLE_FAILED' });
    }
  }

  public static async getNearbyDrivers(req: Request, res: Response): Promise<Response> {
    try {
      const { lat, lng, vehicleType } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ error: 'LOCATION_REQUIRED' });
      }

      // Phase 3: Use Redis Geo for fast nearby driver lookup
      const candidates = await GeoTrackingService.findNearbyDrivers({
        coordinates: [parseFloat(lng as string), parseFloat(lat as string)],
        vehicleType: (vehicleType as string) || 'bajaj',
        radiusKm: 50,
      });

      const locations = candidates.map(c => ({
        userId: c.driverId,
        location: { type: 'Point', coordinates: c.coordinates },
      }));

      return res.status(200).json({
        success: true,
        drivers: locations
      });
    } catch (error) {
      return res.status(500).json({ error: 'DISCOVERY_FAILED' });
    }
  }

  /**
   * Update driver's location atomically.
   * Refactored pipeline:
   *   1. Validate request (coordinates, heading, speed, connectivity)
   *   2. Check idempotency
   *   3. Perform ONE atomic MongoDB update
   *   4. Store idempotency response
   *   5. Return
   */
  public static async updateLocation(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'UNAUTHORIZED' });
      }

      const { coordinates, heading, speed, connectivityState } = req.body;
      const idempotencyKey = req.idempotencyKey;

      // 1. Validate request
      if (
        !coordinates ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number' ||
        isNaN(coordinates[0]) ||
        isNaN(coordinates[1]) ||
        coordinates[0] < -180 ||
        coordinates[0] > 180 ||
        coordinates[1] < -90 ||
        coordinates[1] > 90
      ) {
        return res.status(400).json({ error: 'INVALID_COORDINATES' });
      }

      if (heading !== undefined && (typeof heading !== 'number' || heading < 0 || heading > 360)) {
        return res.status(400).json({ error: 'INVALID_HEADING' });
      }

      if (speed !== undefined && (typeof speed !== 'number' || speed < 0)) {
        return res.status(400).json({ error: 'INVALID_SPEED' });
      }

      if (
        connectivityState !== undefined &&
        !['ACTIVE', 'GRACE_PERIOD', 'STALE', 'OFFLINE'].includes(connectivityState)
      ) {
        return res.status(400).json({ error: 'INVALID_CONNECTIVITY_STATE' });
      }

      // 2. Check idempotency (prevent duplicate DB operations on network retry)
      const lookupKey = idempotencyKey ? `driver:${userId}:update_location:${idempotencyKey}` : null;
      if (lookupKey) {
        const existingReq = await readIdempotency(lookupKey);
        if (existingReq) return res.status(200).json(existingReq.responseBody);
      }

      // 3. Phase 3: Write to Redis Geo (fast path) with lazy MongoDB sync.
      //    Falls back to direct MongoDB write if Redis is unavailable.
      let vehicleType: string | undefined;
      try {
        vehicleType = await GeoTrackingService.getDriverVehicleType(userId);
      } catch {
        // Will be resolved from DriverProfile below
      }

      if (!vehicleType) {
        try {
          const profile = await DriverProfile.findOne(
            { userId: new mongoose.Types.ObjectId(userId) }
          ).select('vehicle.vehicleType').lean();
          vehicleType = profile?.vehicle?.vehicleType || 'bajaj';
        } catch {
          vehicleType = 'bajaj';
        }
      }

      await GeoTrackingService.updateDriverPosition({
        driverId: userId,
        coordinates: coordinates as [number, number],
        heading,
        speed: speed !== undefined ? Math.max(0, speed) : undefined,
        connectivityState: connectivityState || 'ACTIVE',
        isAvailable: true,
        vehicleType,
      });

      // 4. Store idempotency response
      const responsePayload = { success: true };
      if (lookupKey) {
        await writeIdempotency(lookupKey, responsePayload);
      }

      // 5. Return
      return res.status(200).json(responsePayload);
    } catch (error: any) {
      console.error('LOCATION_SYNC_ERROR:', error.message);
      return res.status(500).json({ error: 'SYNC_FAILED' });
    }
  }
}