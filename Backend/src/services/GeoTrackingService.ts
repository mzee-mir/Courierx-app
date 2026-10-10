// services/GeoTrackingService.ts
// Phase 3: Redis Geo telemetry layer for sub-millisecond candidate discovery.
// MongoDB remains the durable source of truth; Redis is the hot-path cache.

import { redisClient } from '../config/redis';
import { DriverLocation } from '../models/DriverLocation';
import { DriverProfile } from '../models/DriverProfile';
import mongoose from 'mongoose';

export interface GeoDriverUpdate {
  driverId: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number;
  speed?: number;
  connectivityState?: string;
  isAvailable?: boolean;
  vehicleType?: string;
}

export interface GeoCandidateResult {
  driverId: string;
  coordinates: [number, number]; // [lng, lat]
  distanceKm: number;
  heading?: number;
  speed?: number;
  connectivityState: string;
}

export class GeoTrackingService {
  /**
   * How often to persist driver location back to MongoDB (ms).
   * Default: 2 minutes. Configurable via GEO_SYNC_INTERVAL_MS env var.
   */
  private static SYNC_INTERVAL_MS = parseInt(
    process.env.GEO_SYNC_INTERVAL_MS || '120000',
    10
  );

  private static GEO_KEY_PREFIX = 'drivers:geo:';
  private static TELEMETRY_KEY_PREFIX = 'driver:telemetry:';
  private static SYNC_KEY_PREFIX = 'driver:lastsync:';
  private static TELEMETRY_TTL_SECONDS = 60;

  // ─────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────

  /**
   * Writes driver position to Redis Geo + telemetry hash.
   * Lazily syncs to MongoDB based on SYNC_INTERVAL_MS.
   *
   * Returns 'REDIS' if written to Redis, 'MONGODB' if fell back.
   */
  public static async updateDriverPosition(
    update: GeoDriverUpdate
  ): Promise<'REDIS' | 'MONGODB'> {
    const geoEngine = process.env.GEO_ENGINE || 'REDIS';

    if (geoEngine === 'MONGODB') {
      await this.writeToMongoDB(update);
      return 'MONGODB';
    }

    try {
      const available = await this.isRedisAvailable();
      if (!available) throw new Error('Redis unavailable');

      await this.writeToRedis(update);
      await this.maybeSyncToMongoDB(update);

      return 'REDIS';
    } catch (err: any) {
      console.warn('[GeoTrackingService] Redis fallback to MongoDB:', err.message);
      await this.writeToMongoDB(update);
      return 'MONGODB';
    }
  }

  /**
   * Removes a driver from the Redis Geo sorted set and deletes their
   * telemetry hash. Called when a driver goes offline.
   */
  public static async removeDriver(
    driverId: string,
    vehicleType?: string
  ): Promise<void> {
    try {
      const available = await this.isRedisAvailable();
      if (!available) return;

      // Resolve vehicle type from telemetry hash if not provided
      let vt = vehicleType;
      if (!vt) {
        vt = await this.getDriverVehicleType(driverId);
      }

      const pipeline = redisClient.pipeline();

      if (vt) {
        pipeline.zrem(`${this.GEO_KEY_PREFIX}${vt}`, driverId);
      }

      pipeline.del(`${this.TELEMETRY_KEY_PREFIX}${driverId}`);
      pipeline.del(`${this.SYNC_KEY_PREFIX}${driverId}`);

      await pipeline.exec();
    } catch (err: any) {
      console.warn('[GeoTrackingService] removeDriver warn:', err.message);
    }
  }

  /**
   * Fast candidate discovery via Redis GEOSEARCH.
   *
   * - Queries the geo sorted set(s) for the requested vehicle type.
   * - Enriches results with telemetry data from per-driver hashes.
   * - Filters out offline/unavailable drivers and excluded IDs.
   * - Returns results sorted by distance ascending.
   *
   * Falls back to MongoDB $near if Redis is unavailable.
   */
  public static async findNearbyDrivers(params: {
    coordinates: [number, number]; // [lng, lat]
    vehicleType: string;
    radiusKm: number;
    excludeDriverIds?: string[];
    limit?: number;
  }): Promise<GeoCandidateResult[]> {
    const geoEngine = process.env.GEO_ENGINE || 'REDIS';

    if (geoEngine === 'MONGODB') {
      return this.findNearbyDriversMongoDB(params);
    }

    try {
      const available = await this.isRedisAvailable();
      if (!available) throw new Error('Redis unavailable');

      return await this.findNearbyDriversRedis(params);
    } catch (err: any) {
      console.warn('[GeoTrackingService] findNearbyDrivers fallback to MongoDB:', err.message);
      return this.findNearbyDriversMongoDB(params);
    }
  }

  /**
   * Forces an immediate write of the current Redis telemetry state
   * back to MongoDB for a specific driver. Used when going offline
   * to ensure MongoDB has the final known position.
   */
  public static async forceMongoSync(driverId: string): Promise<void> {
    try {
      const available = await this.isRedisAvailable();
      if (!available) return;

      const telemetryKey = `${this.TELEMETRY_KEY_PREFIX}${driverId}`;
      const data = await redisClient.hgetall(telemetryKey);
      if (!data || !data.vehicleType) return;

      // Read current position from Redis Geo
      const geoKey = `${this.GEO_KEY_PREFIX}${data.vehicleType}`;
      const pos = await redisClient.geopos(geoKey, driverId);
      if (!pos || !pos[0]) return;

      const [lngStr, latStr] = pos[0];
      const lng = parseFloat(lngStr as string);
      const lat = parseFloat(latStr as string);

      if (isNaN(lng) || isNaN(lat)) return;

      const now = new Date();
      const updatePayload: Record<string, any> = {
        location: { type: 'Point', coordinates: [lng, lat] },
        lastUpdated: now,
        lastHeartbeatAt: now,
        connectivityState: data.connectivityState || 'ACTIVE',
      };

      if (data.heading && data.heading !== '') {
        updatePayload.heading = parseFloat(data.heading);
      }
      if (data.speed && data.speed !== '') {
        updatePayload.speed = parseFloat(data.speed);
      }

      await DriverLocation.findOneAndUpdate(
        { userId: new mongoose.Types.ObjectId(driverId) },
        { $set: updatePayload },
        { upsert: true, new: true }
      );

      // Reset sync tracker
      await redisClient.del(`${this.SYNC_KEY_PREFIX}${driverId}`);
    } catch (err: any) {
      console.warn('[GeoTrackingService] forceMongoSync warn:', err.message);
    }
  }

  /**
   * Checks whether the Redis client is reachable.
   */
  public static async isRedisAvailable(): Promise<boolean> {
    if (process.env.REDIS_URL === 'test') {
      // In test mode Redis may not be running; allow tests to override
      return false;
    }
    try {
      const response = await redisClient.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Reads the driver's vehicle type from the Redis telemetry hash.
   * Returns undefined if not found.
   */
  public static async getDriverVehicleType(
    driverId: string
  ): Promise<string | undefined> {
    try {
      const vt = await redisClient.hget(
        `${this.TELEMETRY_KEY_PREFIX}${driverId}`,
        'vehicleType'
      );
      return vt || undefined;
    } catch {
      return undefined;
    }
  }

  // ─────────────────────────────────────────────
  // Private: Redis write path
  // ─────────────────────────────────────────────

  private static async writeToRedis(update: GeoDriverUpdate): Promise<void> {
    const {
      driverId,
      coordinates,
      heading,
      speed,
      connectivityState,
      isAvailable,
      vehicleType,
    } = update;

    if (!vehicleType) {
      throw new Error('vehicleType is required for Redis Geo write');
    }

    const [lng, lat] = coordinates;
    const geoKey = `${this.GEO_KEY_PREFIX}${vehicleType}`;
    const telemetryKey = `${this.TELEMETRY_KEY_PREFIX}${driverId}`;

    const pipeline = redisClient.pipeline();

    // 1. Add/update position in the geo sorted set
    pipeline.geoadd(geoKey, lng, lat, driverId);

    // 2. Store telemetry metadata in a hash
    const hashFields: Record<string, string> = {
      connectivityState: connectivityState || 'ACTIVE',
      updatedAt: String(Date.now()),
      isAvailable: isAvailable !== false ? '1' : '0',
      vehicleType,
    };
    if (heading !== undefined) hashFields.heading = String(heading);
    if (speed !== undefined) hashFields.speed = String(speed);

    pipeline.hset(telemetryKey, hashFields);

    // 3. Set TTL so disconnected drivers auto-expire
    pipeline.expire(telemetryKey, this.TELEMETRY_TTL_SECONDS);

    await pipeline.exec();
  }

  // ─────────────────────────────────────────────
  // Private: Lazy MongoDB sync
  // ─────────────────────────────────────────────

  private static async maybeSyncToMongoDB(
    update: GeoDriverUpdate
  ): Promise<void> {
    const syncKey = `${this.SYNC_KEY_PREFIX}${update.driverId}`;

    try {
      const lastSync = await redisClient.get(syncKey);

      if (lastSync) {
        const elapsed = Date.now() - parseInt(lastSync, 10);
        if (elapsed < this.SYNC_INTERVAL_MS) {
          // Not time yet — skip MongoDB write
          return;
        }
      }

      // Time to sync — write to MongoDB
      await this.writeToMongoDB(update);

      // Record the sync timestamp with a generous TTL
      await redisClient.setex(syncKey, 600, String(Date.now()));
    } catch (err: any) {
      // Non-fatal: MongoDB sync failure should not block the response
      console.warn('[GeoTrackingService] maybeSyncToMongoDB warn:', err.message);
    }
  }

  // ─────────────────────────────────────────────
  // Private: Direct MongoDB write (Phase 2 path)
  // ─────────────────────────────────────────────

  private static async writeToMongoDB(update: GeoDriverUpdate): Promise<void> {
    const now = new Date();
    const updatePayload: Record<string, any> = {
      location: { type: 'Point', coordinates: update.coordinates },
      lastUpdated: now,
      lastHeartbeatAt: now,
      connectivityState: update.connectivityState || 'ACTIVE',
    };
    if (update.heading !== undefined) updatePayload.heading = update.heading;
    if (update.speed !== undefined) updatePayload.speed = Math.max(0, update.speed);

    await DriverLocation.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(update.driverId) },
      { $set: updatePayload },
      { upsert: true, new: true }
    );
  }

  // ─────────────────────────────────────────────
  // Private: Redis candidate discovery
  // ─────────────────────────────────────────────

  private static async findNearbyDriversRedis(params: {
    coordinates: [number, number];
    vehicleType: string;
    radiusKm: number;
    excludeDriverIds?: string[];
    limit?: number;
  }): Promise<GeoCandidateResult[]> {
    const { coordinates, vehicleType, radiusKm, excludeDriverIds = [], limit } = params;
    const [lng, lat] = coordinates;

    // Determine which geo keys to query.
    // The existing dispatch logic treats "car" as matching both "car" and "van".
    const geoKeys: string[] = [];
    const vt = vehicleType.toLowerCase();
    if (vt === 'car') {
      geoKeys.push(`${this.GEO_KEY_PREFIX}car`);
      geoKeys.push(`${this.GEO_KEY_PREFIX}van`);
    } else {
      geoKeys.push(`${this.GEO_KEY_PREFIX}${vt}`);
    }

    const excludeSet = new Set(excludeDriverIds);
    const allCandidates: Array<{
      driverId: string;
      coordinates: [number, number];
      distanceKm: number;
    }> = [];

    // Query each geo key
    for (const geoKey of geoKeys) {
      try {
        // GEOSEARCH returns [member, distance, [lng, lat]] tuples
        const results = await (redisClient as any).geosearch(
          geoKey,
          'FROMLONLAT',
          lng,
          lat,
          'BYRADIUS',
          radiusKm,
          'km',
          'ASC',
          ...(limit ? ['COUNT', limit] : []),
          'WITHDIST',
          'WITHCOORD'
        ) as Array<[string, string, [string, string]]>;

        if (!results || !Array.isArray(results)) continue;

        for (const entry of results) {
          const driverId = entry[0];
          const distanceKm = parseFloat(entry[1]);
          const [memberLng, memberLat] = entry[2];

          if (excludeSet.has(driverId)) continue;

          // Deduplicate (a driver could theoretically be in multiple sets)
          if (allCandidates.some(c => c.driverId === driverId)) continue;

          allCandidates.push({
            driverId,
            coordinates: [parseFloat(memberLng), parseFloat(memberLat)],
            distanceKm,
          });
        }
      } catch (err: any) {
        console.warn(`[GeoTrackingService] GEOSEARCH on ${geoKey} warn:`, err.message);
      }
    }

    if (allCandidates.length === 0) return [];

    // Enrich with telemetry data (pipelined for performance)
    const telemetryPipeline = redisClient.pipeline();
    for (const c of allCandidates) {
      telemetryPipeline.hgetall(`${this.TELEMETRY_KEY_PREFIX}${c.driverId}`);
    }
    const telemetryResults = await telemetryPipeline.exec();

    const enriched: GeoCandidateResult[] = [];

    for (let i = 0; i < allCandidates.length; i++) {
      const candidate = allCandidates[i];
      const [err, data] = telemetryResults![i];

      if (err || !data || typeof data !== 'object') {
        // Telemetry hash expired or missing — driver is stale, skip
        continue;
      }

      const telemetry = data as Record<string, string>;

      // Filter out unavailable or stale/offline drivers
      if (telemetry.isAvailable !== '1') continue;
      if (
        telemetry.connectivityState === 'STALE' ||
        telemetry.connectivityState === 'OFFLINE'
      ) {
        continue;
      }

      enriched.push({
        driverId: candidate.driverId,
        coordinates: candidate.coordinates,
        distanceKm: candidate.distanceKm,
        heading:
          telemetry.heading && telemetry.heading !== ''
            ? parseFloat(telemetry.heading)
            : undefined,
        speed:
          telemetry.speed && telemetry.speed !== ''
            ? parseFloat(telemetry.speed)
            : undefined,
        connectivityState: telemetry.connectivityState || 'ACTIVE',
      });
    }

    // Already sorted by distance from GEOSEARCH ASC
    return enriched;
  }

  // ─────────────────────────────────────────────
  // Private: MongoDB fallback candidate discovery
  // ─────────────────────────────────────────────

  private static async findNearbyDriversMongoDB(params: {
    coordinates: [number, number];
    vehicleType: string;
    radiusKm: number;
    excludeDriverIds?: string[];
    limit?: number;
  }): Promise<GeoCandidateResult[]> {
    const { coordinates, radiusKm, excludeDriverIds = [] } = params;
    const radiusMeters = radiusKm * 1000;

    const query: any = {
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: radiusMeters,
        },
      },
      isAvailable: true,
      connectivityState: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
    };

    if (excludeDriverIds.length > 0) {
      query.userId = {
        $nin: excludeDriverIds.map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    }

    const queryBuilder: any = DriverLocation.find(query).select('userId location heading speed connectivityState');
    const locations = typeof queryBuilder.limit === 'function'
      ? await queryBuilder.limit(params.limit || 100)
      : await queryBuilder;

    // Compute distances using Haversine (import from MatchingEngine)
    const { MatchingEngine } = await import('./MatchingEngine');

    return locations.map((loc: any) => {
      const driverCoords = loc.location.coordinates as [number, number];
      const distanceKm = MatchingEngine.haversineDistanceKm(
        coordinates,
        driverCoords
      );

      return {
        driverId: loc.userId.toString(),
        coordinates: driverCoords,
        distanceKm: Math.round(distanceKm * 100) / 100,
        heading: loc.heading,
        speed: loc.speed,
        connectivityState: loc.connectivityState,
      };
    });
  }
}
