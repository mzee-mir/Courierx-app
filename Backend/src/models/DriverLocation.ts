import { Schema, model, Document, Types } from 'mongoose';

export type ConnectivityState = 'ACTIVE' | 'GRACE_PERIOD' | 'STALE' | 'OFFLINE';

export const CONNECTIVITY_THRESHOLDS = {
  ACTIVE_MAX_AGE_MS: 45 * 1000,        // <= 45s
  GRACE_PERIOD_MAX_AGE_MS: 120 * 1000, // <= 2 mins
  STALE_MAX_AGE_MS: 300 * 1000,        // <= 5 mins
  // > 5 mins -> OFFLINE
};

/**
 * Evaluates connectivity state purely based on heartbeat age.
 */
export function evaluateConnectivityState(lastHeartbeatAt: Date | number): ConnectivityState {
  const ageMs = Date.now() - new Date(lastHeartbeatAt).getTime();
  if (ageMs <= CONNECTIVITY_THRESHOLDS.ACTIVE_MAX_AGE_MS) return 'ACTIVE';
  if (ageMs <= CONNECTIVITY_THRESHOLDS.GRACE_PERIOD_MAX_AGE_MS) return 'GRACE_PERIOD';
  if (ageMs <= CONNECTIVITY_THRESHOLDS.STALE_MAX_AGE_MS) return 'STALE';
  return 'OFFLINE';
}

export interface IDriverLocation extends Document {
  userId: Types.ObjectId;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  heading?: number;
  speed?: number;
  isAvailable: boolean;
  connectivityState: ConnectivityState;
  lastHeartbeatAt: Date;
  lastUpdated: Date;
}

const DriverLocationSchema = new Schema<IDriverLocation>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val: number[]) {
          return (
            Array.isArray(val) &&
            val.length === 2 &&
            typeof val[0] === 'number' &&
            typeof val[1] === 'number' &&
            !isNaN(val[0]) &&
            !isNaN(val[1]) &&
            val[0] >= -180 &&
            val[0] <= 180 &&
            val[1] >= -90 &&
            val[1] <= 90
          );
        },
        message: 'Coordinates must be valid [longitude (-180..180), latitude (-90..90)]',
      },
    },
  },
  isAvailable: {
    type: Boolean,
    default: false,
  },
  heading: {
    type: Number,
    min: 0,
    max: 360,
  },
  speed: {
    type: Number,
    min: 0,
  },
  connectivityState: {
    type: String,
    enum: ['ACTIVE', 'GRACE_PERIOD', 'STALE', 'OFFLINE'],
    default: 'ACTIVE',
  },
  lastHeartbeatAt: {
    type: Date,
    default: Date.now,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Primary geospatial index for finding nearby drivers
DriverLocationSchema.index({ location: '2dsphere' });

// Fast composite filter for available, connected drivers
DriverLocationSchema.index({ isAvailable: 1, connectivityState: 1 });

// Index on heartbeat for state maintenance / stale transition scans
DriverLocationSchema.index({ lastHeartbeatAt: 1 });

/**
 * Service-level helper to transition stale drivers through connectivity states
 * instead of deleting documents with a TTL index.
 */
export async function transitionStaleDrivers(): Promise<{
  markedGrace: number;
  markedStale: number;
  markedOffline: number;
}> {
  const now = Date.now();
  const graceThreshold = new Date(now - CONNECTIVITY_THRESHOLDS.ACTIVE_MAX_AGE_MS);
  const staleThreshold = new Date(now - CONNECTIVITY_THRESHOLDS.GRACE_PERIOD_MAX_AGE_MS);
  const offlineThreshold = new Date(now - CONNECTIVITY_THRESHOLDS.STALE_MAX_AGE_MS);

  // 1. Move drivers beyond STALE threshold to OFFLINE (and set isAvailable: false)
  const offlineRes = await DriverLocation.updateMany(
    {
      lastHeartbeatAt: { $lt: offlineThreshold },
      connectivityState: { $ne: 'OFFLINE' },
    },
    {
      $set: {
        connectivityState: 'OFFLINE',
        isAvailable: false,
        lastUpdated: new Date(),
      },
    }
  );

  // 2. Move drivers between GRACE and STALE thresholds to STALE
  const staleRes = await DriverLocation.updateMany(
    {
      lastHeartbeatAt: { $gte: offlineThreshold, $lt: staleThreshold },
      connectivityState: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
    },
    {
      $set: {
        connectivityState: 'STALE',
        lastUpdated: new Date(),
      },
    }
  );

  // 3. Move drivers between ACTIVE and GRACE thresholds to GRACE_PERIOD
  const graceRes = await DriverLocation.updateMany(
    {
      lastHeartbeatAt: { $gte: staleThreshold, $lt: graceThreshold },
      connectivityState: 'ACTIVE',
    },
    {
      $set: {
        connectivityState: 'GRACE_PERIOD',
        lastUpdated: new Date(),
      },
    }
  );

  return {
    markedGrace: graceRes.modifiedCount || 0,
    markedStale: staleRes.modifiedCount || 0,
    markedOffline: offlineRes.modifiedCount || 0,
  };
}

export const DriverLocation = model<IDriverLocation>('DriverLocation', DriverLocationSchema);
