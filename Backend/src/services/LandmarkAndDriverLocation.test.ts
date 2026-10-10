import { describe, it } from 'node:test';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { SystemLandmark, ISystemLandmark } from '../models/SystemLandmark';
import {
  DriverLocation,
  evaluateConnectivityState,
  CONNECTIVITY_THRESHOLDS,
  IDriverLocation,
} from '../models/DriverLocation';
import { DriverLandmarkStat } from '../models/DriverLandmarkStat';
import { Order, IOrder } from '../models/Order';
import { LandmarkService } from './LandmarkService';
import { DispatchService, MatchingCriteria } from './DispatchService';
import { DriverController } from '../controllers/DriverController';
import { updateLocationSchema } from '../validations/driver.validation';
import { createOrderSchema } from '../validations/order.validation';
import { OrderStatus, VehicleType } from '../enums/OrderEnums';
import * as idempotencyUtils from '../utils/idempotency';

describe('1. SystemLandmark Model & GeoJSON Foundation', () => {
  it('correctly validates valid GeoJSON Point structure [lng, lat]', () => {
    const landmark = new SystemLandmark({
      name: 'Hotel Shamo',
      officialName: 'Hotel Shamo Mogadishu',
      category: 'hotel',
      location: {
        type: 'Point',
        coordinates: [45.3182, 2.0469],
      },
      verifiedEntryPoints: [
        {
          label: 'Main Gate',
          coordinates: [45.3184, 2.0471],
        },
      ],
    });

    const error = landmark.validateSync();
    assert.strictEqual(error, undefined, 'Valid landmark should not have validation error');
    assert.strictEqual(landmark.location.type, 'Point');
    assert.deepStrictEqual(landmark.location.coordinates, [45.3182, 2.0469]);
    assert.strictEqual(landmark.totalDeliveries, 0);
    assert.strictEqual(landmark.isActive, true);
  });

  it('rejects malformed coordinates (length != 2 or out of bounds)', () => {
    // Length 1
    const bad1 = new SystemLandmark({
      name: 'Bad Coords',
      officialName: 'Bad Coords',
      category: 'hotel',
      location: {
        type: 'Point',
        coordinates: [45.3182] as any,
      },
    });
    const err1 = bad1.validateSync();
    assert.ok(err1?.errors['location.coordinates'], 'Should reject single number coordinate');

    // Out of longitude range
    const bad2 = new SystemLandmark({
      name: 'Bad Longitude',
      officialName: 'Bad Longitude',
      category: 'hotel',
      location: {
        type: 'Point',
        coordinates: [200, 2.0469],
      },
    });
    const err2 = bad2.validateSync();
    assert.ok(err2?.errors['location.coordinates'], 'Should reject longitude > 180');
  });

  it('validates verifiedEntryPoints as an array of labeled coordinates', () => {
    const landmark = new SystemLandmark({
      name: 'Bakara Market',
      officialName: 'Suuqa Bakaaraha',
      category: 'market',
      location: {
        type: 'Point',
        coordinates: [45.321, 2.045],
      },
      verifiedEntryPoints: [
        { label: 'North Entrance', coordinates: [45.3212, 2.0455] },
        { label: 'South Gate', coordinates: [45.3208, 2.0448] },
      ],
    });

    const error = landmark.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(landmark.verifiedEntryPoints.length, 2);
    assert.strictEqual(landmark.verifiedEntryPoints[0].label, 'North Entrance');
    assert.deepStrictEqual(landmark.verifiedEntryPoints[0].coordinates, [45.3212, 2.0455]);
  });

  it('maintains 2dsphere index on location field and name/aliases indexes', () => {
    const indexes = SystemLandmark.schema.indexes();
    const has2dsphere = indexes.some(
      ([fields]) => (fields as any).location === '2dsphere'
    );
    assert.ok(has2dsphere, 'SystemLandmark must have 2dsphere index on location');

    const hasNameIndex = indexes.some(([fields]) => (fields as any).name === 1);
    assert.ok(hasNameIndex, 'SystemLandmark must have index on name');

    const hasAliasesIndex = indexes.some(([fields]) => (fields as any).aliases === 1);
    assert.ok(hasAliasesIndex, 'SystemLandmark must have index on aliases');
  });
});

describe('2. Landmark Resolution & Duplicate Prevention Service', () => {
  it('normalizes names by trimming, lowercasing, and stripping punctuation', () => {
    assert.strictEqual(
      LandmarkService.normalizeLandmarkName('  Hotel Shamo!  '),
      'hotel shamo'
    );
    assert.strictEqual(
      LandmarkService.normalizeLandmarkName('Hotel Shamo - Mogadishu'),
      'hotel shamo mogadishu'
    );
    assert.strictEqual(
      LandmarkService.normalizeLandmarkName("Hoteelka Shamo, Muqdisho"),
      'hoteelka shamo muqdisho'
    );
  });

  it('extracts significant tokens with Somali morphological normalization', () => {
    const tokens1 = LandmarkService.extractTokens('Hotel Shamo');
    const tokens2 = LandmarkService.extractTokens('Hoteelka Shamo Muqdisho');
    const tokens3 = LandmarkService.extractTokens('Shamo Hotel');

    assert.ok(tokens1.includes('shamo') && tokens1.includes('hotel'));
    assert.ok(tokens2.includes('shamo') && tokens2.includes('hotel'));
    // "muqdisho" is a generic city qualifier and stripped
    assert.ok(!tokens2.includes('muqdisho'));
    assert.deepStrictEqual(tokens1.sort(), tokens3.sort());
  });

  it('calculates high similarity between spelling variations and word order', () => {
    // Exact word swap
    const scoreOrder = LandmarkService.calculateNameSimilarity('Hotel Shamo', 'Shamo Hotel');
    assert.strictEqual(scoreOrder, 1.0, 'Reordered words should have 1.0 similarity');

    // Suffix with city
    const scoreCity = LandmarkService.calculateNameSimilarity(
      'Hotel Shamo',
      'Hotel Shamo Muqdisho'
    );
    assert.ok(scoreCity >= 0.85, `Expected >= 0.85, got ${scoreCity}`);

    // Morphological variation (Hoteel vs Hotel)
    const scoreMorph = LandmarkService.calculateNameSimilarity(
      'Hotel Shamo',
      'Hoteelka Shamo'
    );
    assert.ok(scoreMorph >= 0.85, `Expected >= 0.85, got ${scoreMorph}`);

    // Completely different landmark
    const scoreDiff = LandmarkService.calculateNameSimilarity(
      'Hotel Shamo',
      'Bakara Market'
    );
    assert.strictEqual(scoreDiff, 0, 'Completely different landmarks must have 0 score');
  });

  it('detects duplicates when name matches and location is nearby', async () => {
    // Mock findNearbyLandmark
    const originalFindNearby = LandmarkService.findNearbyLandmark;
    try {
      const mockLandmark = {
        _id: new mongoose.Types.ObjectId(),
        name: 'Hotel Shamo',
        officialName: 'Hotel Shamo Mogadishu',
        aliases: ['Shamo Hotel'],
        category: 'hotel',
        location: { type: 'Point', coordinates: [45.3182, 2.0469] },
        isActive: true,
      } as any;

      LandmarkService.findNearbyLandmark = async () => [mockLandmark];

      // 1. Same normalized name near coordinates
      const match1 = await LandmarkService.checkDuplicateLandmark(
        'Hotel Shamo',
        [45.3183, 2.047]
      );
      assert.ok(match1, 'Should find match for exact name');
      assert.strictEqual(match1?._id.toString(), mockLandmark._id.toString());

      // 2. Transliteration / City variant near coordinates
      const match2 = await LandmarkService.checkDuplicateLandmark(
        'Hotel Shamo Muqdisho',
        [45.3183, 2.047]
      );
      assert.ok(match2, 'Should find match for city variant');
      assert.strictEqual(match2?._id.toString(), mockLandmark._id.toString());

      // 3. Reversed word order matching alias
      const match3 = await LandmarkService.checkDuplicateLandmark(
        'Shamo Hotel',
        [45.3183, 2.047]
      );
      assert.ok(match3, 'Should find match for alias');
      assert.strictEqual(match3?._id.toString(), mockLandmark._id.toString());
    } finally {
      LandmarkService.findNearbyLandmark = originalFindNearby;
    }
  });

  it('does not match when coordinates are not nearby', async () => {
    const originalFindNearby = LandmarkService.findNearbyLandmark;
    try {
      // Empty when query is outside proximity radius
      LandmarkService.findNearbyLandmark = async () => [];

      const match = await LandmarkService.checkDuplicateLandmark(
        'Hotel Shamo',
        [45.45, 2.15]
      );
      assert.strictEqual(match, null, 'Faraway coordinate must return null');
    } finally {
      LandmarkService.findNearbyLandmark = originalFindNearby;
    }
  });

  it('does not create a public landmark when resolving arbitrary private locations', async () => {
    const originalFindNearby = LandmarkService.findNearbyLandmark;
    try {
      LandmarkService.findNearbyLandmark = async () => [];

      const result = await LandmarkService.resolveLandmark(
        'Private Residence Door 4',
        [45.33, 2.04]
      );
      assert.strictEqual(result, null, 'resolveLandmark must not create public landmarks');
    } finally {
      LandmarkService.findNearbyLandmark = originalFindNearby;
    }
  });
});

describe('3. DriverLocation Model & Connectivity State Machine', () => {
  it('does NOT have TTL deletion index on lastUpdated', () => {
    const indexes = DriverLocation.schema.indexes();
    const hasTtl = indexes.some(([, options]) => (options as any)?.expireAfterSeconds !== undefined);
    assert.strictEqual(hasTtl, false, 'DriverLocation must NOT have any TTL deletion index');
  });

  it('has 2dsphere index and compound availability index', () => {
    const indexes = DriverLocation.schema.indexes();
    const has2dsphere = indexes.some(([fields]) => (fields as any).location === '2dsphere');
    assert.ok(has2dsphere, 'DriverLocation must have 2dsphere index on location');

    const hasAvailability = indexes.some(
      ([fields]) => (fields as any).isAvailable === 1 && (fields as any).connectivityState === 1
    );
    assert.ok(hasAvailability, 'DriverLocation must have index on isAvailable and connectivityState');
  });

  it('validates connectivity states and telemetry fields', () => {
    const validLoc = new DriverLocation({
      userId: new mongoose.Types.ObjectId(),
      location: {
        type: 'Point',
        coordinates: [45.3182, 2.0469],
      },
      heading: 180,
      speed: 25.5,
      isAvailable: true,
      connectivityState: 'ACTIVE',
      lastHeartbeatAt: new Date(),
    });

    const error = validLoc.validateSync();
    assert.strictEqual(error, undefined);
    assert.strictEqual(validLoc.heading, 180);
    assert.strictEqual(validLoc.speed, 25.5);
    assert.strictEqual(validLoc.connectivityState, 'ACTIVE');
  });

  it('evaluates connectivity states correctly based on heartbeat age', () => {
    const now = Date.now();

    // 10s old -> ACTIVE
    assert.strictEqual(evaluateConnectivityState(now - 10 * 1000), 'ACTIVE');

    // 60s old -> GRACE_PERIOD
    assert.strictEqual(evaluateConnectivityState(now - 60 * 1000), 'GRACE_PERIOD');

    // 3 minutes old -> STALE
    assert.strictEqual(evaluateConnectivityState(now - 180 * 1000), 'STALE');

    // 6 minutes old -> OFFLINE
    assert.strictEqual(evaluateConnectivityState(now - 360 * 1000), 'OFFLINE');
  });
});

describe('4. updateLocation Request Validation & Single Atomic Write', () => {
  it('validates coordinates with updateLocationSchema', () => {
    // Valid
    const validResult = updateLocationSchema.body.safeParse({
      coordinates: [45.3182, 2.0469],
      heading: 90,
      speed: 15,
      connectivityState: 'ACTIVE',
    });
    assert.ok(validResult.success);

    // Invalid coordinates (out of range lat)
    const invalidLat = updateLocationSchema.body.safeParse({
      coordinates: [45.3182, 100],
    });
    assert.strictEqual(invalidLat.success, false);

    // Invalid heading (> 360)
    const invalidHeading = updateLocationSchema.body.safeParse({
      coordinates: [45.3182, 2.0469],
      heading: 400,
    });
    assert.strictEqual(invalidHeading.success, false);

    // Negative speed
    const invalidSpeed = updateLocationSchema.body.safeParse({
      coordinates: [45.3182, 2.0469],
      speed: -5,
    });
    assert.strictEqual(invalidSpeed.success, false);
  });

  it('controller rejects invalid coordinates before any database write', async () => {
    let dbWriteOccurred = false;
    const originalFindOneAndUpdate = DriverLocation.findOneAndUpdate;
    DriverLocation.findOneAndUpdate = (async () => {
      dbWriteOccurred = true;
      return null;
    }) as any;

    try {
      const req: any = {
        user: { userId: new mongoose.Types.ObjectId().toString() },
        body: { coordinates: [200, 2.0] }, // invalid longitude
      };
      let statusSent = 0;
      let bodySent: any = null;
      const res: any = {
        status: (code: number) => {
          statusSent = code;
          return {
            json: (payload: any) => {
              bodySent = payload;
              return payload;
            },
          };
        },
      };

      await DriverController.updateLocation(req, res);

      assert.strictEqual(statusSent, 400);
      assert.strictEqual(bodySent?.error, 'INVALID_COORDINATES');
      assert.strictEqual(dbWriteOccurred, false, 'No database write must occur on invalid input');
    } finally {
      DriverLocation.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it('performs exactly ONE atomic update on valid request', async () => {
    let updateCallCount = 0;
    let capturedUpdatePayload: any = null;
    const originalFindOneAndUpdate = DriverLocation.findOneAndUpdate;
    DriverLocation.findOneAndUpdate = (async (_query: any, update: any) => {
      updateCallCount++;
      capturedUpdatePayload = update;
      return { _id: new mongoose.Types.ObjectId() };
    }) as any;

    try {
      const userId = new mongoose.Types.ObjectId().toString();
      const req: any = {
        user: { userId },
        body: {
          coordinates: [45.3182, 2.0469],
          heading: 120,
          speed: 20,
          connectivityState: 'ACTIVE',
        },
      };
      let statusSent = 0;
      let bodySent: any = null;
      const res: any = {
        status: (code: number) => {
          statusSent = code;
          return {
            json: (payload: any) => {
              bodySent = payload;
              return payload;
            },
          };
        },
      };

      await DriverController.updateLocation(req, res);

      assert.strictEqual(statusSent, 200);
      assert.strictEqual(bodySent?.success, true);
      assert.strictEqual(updateCallCount, 1, 'Must execute exactly ONE atomic update');
      assert.deepStrictEqual(capturedUpdatePayload.$set.location, {
        type: 'Point',
        coordinates: [45.3182, 2.0469],
      });
      assert.strictEqual(capturedUpdatePayload.$set.heading, 120);
      assert.strictEqual(capturedUpdatePayload.$set.speed, 20);
      assert.strictEqual(capturedUpdatePayload.$set.connectivityState, 'ACTIVE');
      assert.ok(capturedUpdatePayload.$set.lastHeartbeatAt instanceof Date);
      assert.ok(capturedUpdatePayload.$set.lastUpdated instanceof Date);
    } finally {
      DriverLocation.findOneAndUpdate = originalFindOneAndUpdate;
    }
  });

  it('replays cached response on duplicate idempotent request without DB write', async () => {
    let updateCallCount = 0;
    const originalFindOneAndUpdate = DriverLocation.findOneAndUpdate;
    DriverLocation.findOneAndUpdate = (async () => {
      updateCallCount++;
      return {};
    }) as any;

    const { Idempotency } = await import('../models/Idempotency');
    const originalFindOne = Idempotency.findOne;
    try {
      // Mock existing idempotency hit via Mongoose model
      Idempotency.findOne = (async () => ({
        responseBody: { success: true, replayed: true },
      })) as any;

      const req: any = {
        user: { userId: new mongoose.Types.ObjectId().toString() },
        idempotencyKey: 'test-replay-key-123',
        body: { coordinates: [45.3182, 2.0469] },
      };
      let statusSent = 0;
      let bodySent: any = null;
      const res: any = {
        status: (code: number) => {
          statusSent = code;
          return {
            json: (payload: any) => {
              bodySent = payload;
              return payload;
            },
          };
        },
      };

      await DriverController.updateLocation(req, res);

      assert.strictEqual(statusSent, 200);
      assert.strictEqual(bodySent?.replayed, true);
      assert.strictEqual(updateCallCount, 0, 'No DB update when idempotency key is replayed');
    } finally {
      DriverLocation.findOneAndUpdate = originalFindOneAndUpdate;
      Idempotency.findOne = originalFindOne;
    }
  });
});

describe('5. Driver Familiarity & Landmark Counters', () => {
  it('increments DriverLandmarkStat and SystemLandmark counters atomically', async () => {
    let statUpdateParams: any = null;
    let landmarkUpdateParams: any = null;

    const origStatUpdate = DriverLandmarkStat.findOneAndUpdate;
    const origLandmarkUpdate = SystemLandmark.findByIdAndUpdate;

    (DriverLandmarkStat as any).findOneAndUpdate = async (query: any, update: any) => {
      statUpdateParams = { query, update };
      return {};
    };
    (SystemLandmark as any).findByIdAndUpdate = async (id: any, update: any) => {
      landmarkUpdateParams = { id, update };
      return {};
    };

    try {
      const driverId = new mongoose.Types.ObjectId();
      const landmarkId = new mongoose.Types.ObjectId();

      await LandmarkService.recordSuccessfulDelivery(driverId, landmarkId);

      assert.ok(statUpdateParams, 'DriverLandmarkStat must be updated');
      assert.deepStrictEqual(statUpdateParams.query.driverId, driverId);
      assert.deepStrictEqual(statUpdateParams.query.systemLandmarkId, landmarkId);
      assert.strictEqual(statUpdateParams.update.$inc.completedDeliveries, 1);
      assert.ok(statUpdateParams.update.$set.lastDeliveredAt instanceof Date);

      assert.ok(landmarkUpdateParams, 'SystemLandmark must be updated');
      assert.deepStrictEqual(landmarkUpdateParams.id, landmarkId);
      assert.strictEqual(landmarkUpdateParams.update.$inc.totalDeliveries, 1);
    } finally {
      DriverLandmarkStat.findOneAndUpdate = origStatUpdate;
      SystemLandmark.findByIdAndUpdate = origLandmarkUpdate;
    }
  });
});

describe('6. Order Landmark Integration & Authoritative Coordinates', () => {
  it('preserves authoritative coordinates and supports optional landmark IDs', () => {
    const pickupLandmarkId = new mongoose.Types.ObjectId();
    const dropoffLandmarkId = new mongoose.Types.ObjectId();

    const order = new Order({
      customerId: new mongoose.Types.ObjectId(),
      pickupLocation: {
        type: 'Point',
        coordinates: [45.3182, 2.0469],
      },
      pickupLandmark: 'Hotel Shamo',
      pickupLandmarkId,
      dropoffLocation: {
        type: 'Point',
        coordinates: [45.333, 2.0369],
      },
      dropoffLandmark: 'Mogadishu Port',
      dropoffLandmarkId,
      vehicleType: VehicleType.BAJAJ,
      price: 15,
      commission: 2.25,
      verificationPin: '1234',
    });

    const error = order.validateSync();
    assert.strictEqual(error, undefined, 'Order validation should pass');

    // Authoritative coordinates remain intact
    assert.deepStrictEqual(order.pickupLocation.coordinates, [45.3182, 2.0469]);
    assert.deepStrictEqual(order.dropoffLocation.coordinates, [45.333, 2.0369]);

    // Virtual getters work cleanly
    assert.deepStrictEqual(order.pickupCoordinates, [45.3182, 2.0469]);
    assert.deepStrictEqual(order.dropoffCoordinates, [45.333, 2.0369]);

    // Landmark references are preserved
    assert.strictEqual(order.pickupLandmarkId?.toString(), pickupLandmarkId.toString());
    assert.strictEqual(order.dropoffLandmarkId?.toString(), dropoffLandmarkId.toString());
  });

  it('validates createOrderSchema allows landmark IDs and coordinates', () => {
    const valid = createOrderSchema.body.safeParse({
      pickupLocation: {
        type: 'Point',
        coordinates: [45.3182, 2.0469],
      },
      pickupLandmark: 'Hotel Shamo',
      pickupLandmarkId: new mongoose.Types.ObjectId().toString(),
      dropoffLocation: {
        type: 'Point',
        coordinates: [45.333, 2.0369],
      },
      dropoffLandmark: 'Mogadishu Port',
      dropoffLandmarkId: new mongoose.Types.ObjectId().toString(),
      vehicleType: VehicleType.CAR,
    });

    assert.ok(valid.success, 'Schema should parse valid order with landmark IDs');
  });

  it('candidate matching interface receives all coordinates and landmark IDs', async () => {
    let capturedCriteria: MatchingCriteria | null = null;
    const origFind = DriverLocation.find;

    (DriverLocation as any).find = () => ({
      select: async () => [],
    });

    try {
      const criteria: MatchingCriteria = {
        pickupCoordinates: [45.3182, 2.0469],
        pickupLandmarkId: new mongoose.Types.ObjectId(),
        dropoffCoordinates: [45.333, 2.0369],
        dropoffLandmarkId: new mongoose.Types.ObjectId(),
        vehicleType: 'car',
        radiusInMeters: 5000,
      };

      const result = await DispatchService.findCandidates(criteria);
      assert.deepStrictEqual(result, []);
    } finally {
      DriverLocation.find = origFind;
    }
  });
});
