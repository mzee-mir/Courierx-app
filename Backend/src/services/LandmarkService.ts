import mongoose, { Types, ClientSession } from 'mongoose';
import { SystemLandmark, ISystemLandmark } from '../models/SystemLandmark';
import { DriverLandmarkStat } from '../models/DriverLandmarkStat';

export interface CreateLandmarkInput {
  name: string;
  coordinates: [number, number]; // [lng, lat]
  category?: 'hotel' | 'market' | 'hospital' | 'government' | 'port' | string;
  officialName?: string;
  aliases?: string[];
  allowCreate?: boolean;
}

export class LandmarkService {
  /**
   * Normalizes a landmark name for canonical comparison and duplicate detection.
   * - Lowercase and trim
   * - Collapse multiple whitespaces and punctuation
   * - Strips common affixes and transliteration differences (hotel/hoteel/hoteelka)
   */
  public static normalizeLandmarkName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extracts significant keyword tokens from a name.
   */
  public static extractTokens(name: string): string[] {
    const normalized = this.normalizeLandmarkName(name);
    if (!normalized) return [];

    // Stopwords/generic city modifiers that don't distinguish a landmark
    const genericQualifiers = new Set([
      'muqdisho',
      'mogadishu',
      'somalia',
      'soomaaliya',
      'branch',
      'degmada',
      'dhow',
      'near',
      'opposite',
      'hor',
    ]);

    // Normalize Somali morphological variants for common noun types
    const normalizeWord = (w: string) => {
      if (w.startsWith('hoteel') || w.startsWith('hotel')) return 'hotel';
      if (w.startsWith('dekad') || w.startsWith('dekeda') || w.startsWith('port')) return 'port';
      if (w.startsWith('suuq') || w.startsWith('suuqa') || w.startsWith('bazar') || w.startsWith('market')) return 'market';
      if (w.startsWith('isbitaal') || w.startsWith('hospital')) return 'hospital';
      return w;
    };

    return normalized
      .split(' ')
      .map(w => w.trim())
      .filter(w => w.length > 0 && !genericQualifiers.has(w))
      .map(normalizeWord);
  }

  /**
   * Evaluates name similarity between a query name and a target name/alias.
   * Returns a score between 0 and 1.
   */
  public static calculateNameSimilarity(queryName: string, targetName: string): number {
    const normQ = this.normalizeLandmarkName(queryName);
    const normT = this.normalizeLandmarkName(targetName);

    if (normQ === normT) return 1.0;

    const tokensQ = this.extractTokens(queryName);
    const tokensT = this.extractTokens(targetName);

    if (tokensQ.length === 0 || tokensT.length === 0) return 0;

    const setQ = new Set(tokensQ);
    const setT = new Set(tokensT);

    // Exact set match
    if (tokensQ.length === tokensT.length && tokensQ.every(t => setT.has(t))) {
      return 1.0;
    }

    // Token intersection
    let intersectionCount = 0;
    for (const t of setQ) {
      if (setT.has(t)) intersectionCount++;
    }

    const unionCount = new Set([...tokensQ, ...tokensT]).size;
    const jaccard = intersectionCount / unionCount;

    // If one is an exact subset of the other (e.g. "Hotel Shamo" subset of "Hotel Shamo Muqdisho")
    const isSubset =
      intersectionCount === setQ.size || intersectionCount === setT.size;

    if (isSubset && intersectionCount >= 1) {
      // High confidence subset match
      return Math.max(jaccard, 0.85);
    }

    return jaccard;
  }

  /**
   * Finds active system landmarks within a given radius using GeoJSON 2dsphere.
   */
  public static async findNearbyLandmark(
    coordinates: [number, number],
    radiusMeters: number = 500
  ): Promise<ISystemLandmark[]> {
    return SystemLandmark.find({
      isActive: true,
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: radiusMeters,
        },
      },
    });
  }

  /**
   * Checks whether a landmark already exists near the supplied coordinates
   * taking into account normalized name, aliases, and geographic proximity.
   */
  public static async checkDuplicateLandmark(
    name: string,
    coordinates: [number, number],
    radiusMeters: number = 500
  ): Promise<ISystemLandmark | null> {
    const nearby = await this.findNearbyLandmark(coordinates, radiusMeters);
    if (!nearby || nearby.length === 0) return null;

    let bestMatch: ISystemLandmark | null = null;
    let highestScore = 0;

    for (const landmark of nearby) {
      // 1. Direct name match
      const nameScore = this.calculateNameSimilarity(name, landmark.name);
      const officialScore = this.calculateNameSimilarity(name, landmark.officialName);

      let aliasScore = 0;
      if (landmark.aliases && landmark.aliases.length > 0) {
        for (const alias of landmark.aliases) {
          const s = this.calculateNameSimilarity(name, alias);
          if (s > aliasScore) aliasScore = s;
        }
      }

      const maxCandidateScore = Math.max(nameScore, officialScore, aliasScore);

      // Match threshold: >= 0.7 considered duplicate
      if (maxCandidateScore >= 0.7 && maxCandidateScore > highestScore) {
        highestScore = maxCandidateScore;
        bestMatch = landmark;
      }
    }

    return bestMatch;
  }

  /**
   * Resolves a landmark from input name and coordinates.
   * Does NOT create a new landmark if not found (prevents turning private addresses into public landmarks).
   */
  public static async resolveLandmark(
    name: string,
    coordinates: [number, number],
    radiusMeters: number = 500
  ): Promise<ISystemLandmark | null> {
    if (!name || !coordinates || coordinates.length !== 2) return null;
    return this.checkDuplicateLandmark(name, coordinates, radiusMeters);
  }

  /**
   * Creates a new SystemLandmark or resolves to an existing one if a duplicate
   * is detected within the proximity radius.
   */
  public static async createOrResolveLandmark(
    data: CreateLandmarkInput,
    radiusMeters: number = 500
  ): Promise<{ landmark: ISystemLandmark | null; isNew: boolean }> {
    // 1. Check for nearby duplicate first
    const existing = await this.checkDuplicateLandmark(data.name, data.coordinates, radiusMeters);

    if (existing) {
      // If the incoming name is not yet registered as an alias, add it
      const normalizedNew = this.normalizeLandmarkName(data.name);
      const normalizedExisting = this.normalizeLandmarkName(existing.name);
      const hasAlias = existing.aliases.some(
        a => this.normalizeLandmarkName(a) === normalizedNew
      );

      if (normalizedNew !== normalizedExisting && !hasAlias) {
        await this.addAlias(existing._id as Types.ObjectId, data.name);
      }

      return { landmark: existing, isNew: false };
    }

    // 2. If allowCreate is explicitly false, do not create
    if (data.allowCreate === false) {
      return { landmark: null, isNew: false };
    }

    // 3. Create new landmark
    const [landmark] = await SystemLandmark.create([
      {
        name: data.name.trim(),
        officialName: (data.officialName || data.name).trim(),
        aliases: data.aliases || [],
        category: data.category || 'hotel',
        location: {
          type: 'Point',
          coordinates: data.coordinates,
        },
        verifiedEntryPoints: [],
        totalDeliveries: 0,
        isActive: true,
      },
    ]);

    return { landmark, isNew: true };
  }

  /**
   * Adds an alias to an existing landmark.
   */
  public static async addAlias(
    landmarkId: string | Types.ObjectId,
    alias: string
  ): Promise<ISystemLandmark | null> {
    const trimmed = alias.trim();
    if (!trimmed) return null;

    return SystemLandmark.findByIdAndUpdate(
      landmarkId,
      { $addToSet: { aliases: trimmed } },
      { new: true }
    );
  }

  /**
   * Adds a verified entry point to an existing landmark.
   */
  public static async addVerifiedEntryPoint(
    landmarkId: string | Types.ObjectId,
    entryPoint: { label: string; coordinates: [number, number] }
  ): Promise<ISystemLandmark | null> {
    return SystemLandmark.findByIdAndUpdate(
      landmarkId,
      { $push: { verifiedEntryPoints: entryPoint } },
      { new: true }
    );
  }

  /**
   * Records a successful delivery at a landmark:
   * - Increments DriverLandmarkStat.completedDeliveries
   * - Updates DriverLandmarkStat.lastDeliveredAt
   * - Increments SystemLandmark.totalDeliveries
   */
  public static async recordSuccessfulDelivery(
    driverId: Types.ObjectId | string,
    landmarkId: Types.ObjectId | string,
    session?: ClientSession
  ): Promise<void> {
    const now = new Date();
    const dId = new mongoose.Types.ObjectId(driverId);
    const lId = new mongoose.Types.ObjectId(landmarkId);

    // Atomically upsert driver familiarity record
    await DriverLandmarkStat.findOneAndUpdate(
      { driverId: dId, systemLandmarkId: lId },
      {
        $inc: { completedDeliveries: 1 },
        $set: { lastDeliveredAt: now },
      },
      { upsert: true, session }
    );

    // Atomically increment system landmark aggregate deliveries
    await SystemLandmark.findByIdAndUpdate(
      lId,
      { $inc: { totalDeliveries: 1 } },
      session ? { session } : undefined
    );
  }

  /**
   * Phase 4: Records driver post-delivery pin accuracy feedback for a landmark.
   * "Pin Accurate: Yes" increases confidenceScore by +5.
   * "Pin Accurate: No" decreases confidenceScore by -10.
   * Clamps confidenceScore between 0 and 100.
   */
  public static async recordFeedback(
    landmarkId: Types.ObjectId | string,
    isAccurate: boolean
  ): Promise<ISystemLandmark | null> {
    const delta = isAccurate ? 5 : -10;
    const lId = new mongoose.Types.ObjectId(landmarkId);

    await SystemLandmark.findByIdAndUpdate(lId, {
      $inc: {
        positiveConfirmations: isAccurate ? 1 : 0,
        negativeConfirmations: !isAccurate ? 1 : 0,
      },
      $set: { updatedAt: new Date() },
    });

    const landmark = await SystemLandmark.findById(lId);
    if (landmark) {
      const currentScore = landmark.confidenceScore !== undefined ? landmark.confidenceScore : 50;
      const updated = Math.min(100, Math.max(0, currentScore + delta));
      landmark.confidenceScore = updated;
      await landmark.save();
    }
    return landmark;
  }
}

