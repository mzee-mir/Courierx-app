import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { GeoTrackingService, GeoDriverUpdate, GeoCandidateResult } from './GeoTrackingService';
import { MatchingEngine } from './MatchingEngine';

/**
 * Phase 3 — GeoTrackingService Unit Tests
 *
 * These tests validate the GeoTrackingService logic WITHOUT requiring
 * a live Redis instance. In test mode (NODE_ENV=test), isRedisAvailable()
 * returns false, so all operations fall back to MongoDB path or are
 * tested via direct method invocation with mocked Redis.
 *
 * For integration tests with a real Redis instance, set
 * GEO_ENGINE=REDIS and ensure Redis is running locally.
 */

describe('GeoTrackingService', () => {

  it('exports the expected public interface', () => {
    assert.strictEqual(typeof GeoTrackingService.updateDriverPosition, 'function');
    assert.strictEqual(typeof GeoTrackingService.removeDriver, 'function');
    assert.strictEqual(typeof GeoTrackingService.findNearbyDrivers, 'function');
    assert.strictEqual(typeof GeoTrackingService.forceMongoSync, 'function');
    assert.strictEqual(typeof GeoTrackingService.isRedisAvailable, 'function');
    assert.strictEqual(typeof GeoTrackingService.getDriverVehicleType, 'function');
  });

  it('isRedisAvailable returns false in test environment', async () => {
    const result = await GeoTrackingService.isRedisAvailable();
    assert.strictEqual(result, false, 'Should return false when NODE_ENV=test');
  });

  it('updateDriverPosition falls back to MONGODB when GEO_ENGINE=MONGODB', async () => {
    // Temporarily set GEO_ENGINE to MONGODB
    const originalGeoEngine = process.env.GEO_ENGINE;
    process.env.GEO_ENGINE = 'MONGODB';

    // Mock DriverLocation.findOneAndUpdate to avoid real DB call
    const { DriverLocation } = await import('../models/DriverLocation');
    const originalFindOneAndUpdate = DriverLocation.findOneAndUpdate;
    let mongoWriteCalled = false;

    (DriverLocation as any).findOneAndUpdate = async () => {
      mongoWriteCalled = true;
      return {};
    };

    try {
      const result = await GeoTrackingService.updateDriverPosition({
        driverId: '507f1f77bcf86cd799439011',
        coordinates: [45.3, 2.05],
        heading: 90,
        speed: 25,
        connectivityState: 'ACTIVE',
        isAvailable: true,
        vehicleType: 'bajaj',
      });

      assert.strictEqual(result, 'MONGODB', 'Should return MONGODB when GEO_ENGINE=MONGODB');
      assert.strictEqual(mongoWriteCalled, true, 'Should have written to MongoDB');
    } finally {
      process.env.GEO_ENGINE = originalGeoEngine;
      DriverLocation.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it('updateDriverPosition falls back to MONGODB when Redis is unavailable (test env)', async () => {
    const originalGeoEngine = process.env.GEO_ENGINE;
    process.env.GEO_ENGINE = 'REDIS';

    const { DriverLocation } = await import('../models/DriverLocation');
    const originalFindOneAndUpdate = DriverLocation.findOneAndUpdate;
    let mongoWriteCalled = false;

    (DriverLocation as any).findOneAndUpdate = async () => {
      mongoWriteCalled = true;
      return {};
    };

    try {
      // In test mode, isRedisAvailable returns false, so it should fallback
      const result = await GeoTrackingService.updateDriverPosition({
        driverId: '507f1f77bcf86cd799439011',
        coordinates: [45.3, 2.05],
        heading: 180,
        speed: 15,
        connectivityState: 'ACTIVE',
        isAvailable: true,
        vehicleType: 'car',
      });

      assert.strictEqual(result, 'MONGODB', 'Should fallback to MONGODB when Redis is unavailable');
      assert.strictEqual(mongoWriteCalled, true, 'Should have written to MongoDB as fallback');
    } finally {
      process.env.GEO_ENGINE = originalGeoEngine;
      DriverLocation.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it('findNearbyDrivers falls back to MongoDB $near when GEO_ENGINE=MONGODB', async () => {
    const originalGeoEngine = process.env.GEO_ENGINE;
    process.env.GEO_ENGINE = 'MONGODB';

    const { DriverLocation } = await import('../models/DriverLocation');
    const originalFind = DriverLocation.find;
    let mongoQueryCalled = false;

    // Mock DriverLocation.find to return empty array (chainable)
    (DriverLocation as any).find = () => {
      mongoQueryCalled = true;
      return {
        select: () => ({
          limit: () => [],
        }),
      };
    };

    try {
      const results = await GeoTrackingService.findNearbyDrivers({
        coordinates: [45.3, 2.05],
        vehicleType: 'bajaj',
        radiusKm: 5,
      });

      assert.ok(Array.isArray(results), 'Should return an array');
      assert.strictEqual(mongoQueryCalled, true, 'Should have queried MongoDB');
    } finally {
      process.env.GEO_ENGINE = originalGeoEngine;
      DriverLocation.find = originalFind;
    }
  });

  it('removeDriver does not throw in test environment (Redis unavailable)', async () => {
    // removeDriver should gracefully handle Redis unavailability
    await assert.doesNotReject(
      () => GeoTrackingService.removeDriver('507f1f77bcf86cd799439011', 'bajaj'),
      'removeDriver should not throw when Redis is unavailable'
    );
  });

  it('forceMongoSync does not throw in test environment (Redis unavailable)', async () => {
    await assert.doesNotReject(
      () => GeoTrackingService.forceMongoSync('507f1f77bcf86cd799439011'),
      'forceMongoSync should not throw when Redis is unavailable'
    );
  });

  it('getDriverVehicleType returns undefined when Redis is unavailable', async () => {
    const result = await GeoTrackingService.getDriverVehicleType('507f1f77bcf86cd799439011');
    assert.strictEqual(result, undefined, 'Should return undefined when Redis is unreachable');
  });

  it('Haversine distance matches expected values for known Mogadishu coordinates', () => {
    // K5 junction (Mogadishu center) to Bakara Market (approx)
    const k5: [number, number] = [45.3182, 2.0469];
    const bakara: [number, number] = [45.3337, 2.0368];

    const distance = MatchingEngine.haversineDistanceKm(k5, bakara);

    // Expected ~1.9 km (sanity check for scoring accuracy)
    assert.ok(distance > 1.0, `Distance should be > 1 km, got ${distance}`);
    assert.ok(distance < 3.0, `Distance should be < 3 km, got ${distance}`);
  });

  it('GeoDriverUpdate interface accepts all required and optional fields', () => {
    // Type-level validation — ensures the interface contract is correct
    const update: GeoDriverUpdate = {
      driverId: '507f1f77bcf86cd799439011',
      coordinates: [45.3, 2.05],
      heading: 270,
      speed: 30,
      connectivityState: 'ACTIVE',
      isAvailable: true,
      vehicleType: 'bajaj',
    };

    assert.strictEqual(update.driverId, '507f1f77bcf86cd799439011');
    assert.deepStrictEqual(update.coordinates, [45.3, 2.05]);
    assert.strictEqual(update.vehicleType, 'bajaj');
  });

  it('GeoCandidateResult interface has all expected fields', () => {
    const candidate: GeoCandidateResult = {
      driverId: '507f1f77bcf86cd799439011',
      coordinates: [45.3, 2.05],
      distanceKm: 1.5,
      heading: 90,
      speed: 20,
      connectivityState: 'ACTIVE',
    };

    assert.strictEqual(candidate.driverId, '507f1f77bcf86cd799439011');
    assert.strictEqual(candidate.distanceKm, 1.5);
    assert.strictEqual(candidate.connectivityState, 'ACTIVE');
  });
});
