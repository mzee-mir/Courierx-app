export interface CandidateDriverInput {
  driverId: string;
  coordinates: [number, number]; // [lng, lat]
  heading?: number; // 0 - 360
  speed?: number; // km/h
  vehicleType: string;
  completedLandmarkDeliveries?: number;
  lastDutyToggleAt?: Date | number;
  totalOffersReceived?: number;
  totalOffersAccepted?: number;
  isChained?: boolean;
  activeOrderRemainingMinutes?: number; // Estimated time left on current delivery
  rating?: number; // Driver rating (e.g. 1-5, default 5)
}

export interface CandidateScoreResult {
  driverId: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  scoreBreakdown: {
    etaMinutes: number;
    etaScore: number;
    eatMinutes?: number;
    eatScore?: number;
    landmarkScore: number;
    headingScore: number;
    idleScore: number;
    acceptanceScore: number;
    trustScore?: number;
  };
}

export class MatchingEngine {
  /**
   * Converts degrees to radians.
   */
  public static toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Converts radians to degrees.
   */
  public static toDeg(rad: number): number {
    return (rad * 180) / Math.PI;
  }

  /**
   * Calculates great-circle distance between two [lng, lat] points in kilometers.
   */
  public static haversineDistanceKm(
    a: [number, number],
    b: [number, number]
  ): number {
    const [lon1, lat1] = a;
    const [lon2, lat2] = b;
    const R = 6371; // Earth's mean radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const sinHalfLat = Math.sin(dLat / 2);
    const sinHalfLon = Math.sin(dLon / 2);

    const chord =
      sinHalfLat * sinHalfLat +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        sinHalfLon *
        sinHalfLon;

    const c = 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(1 - chord));
    return R * c;
  }

  /**
   * Calculates forward azimuth / initial bearing from point A to point B in degrees [0, 360).
   */
  public static calculateBearing(
    from: [number, number],
    to: [number, number]
  ): number {
    const [lon1, lat1] = from;
    const [lon2, lat2] = to;

    const phi1 = this.toRad(lat1);
    const phi2 = this.toRad(lat2);
    const deltaLambda = this.toRad(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    const bearingDeg = (this.toDeg(theta) + 360) % 360;
    return bearingDeg;
  }

  /**
   * Computes the angular difference between driver heading and bearing to pickup.
   * Returns angular error in degrees [0, 180].
   */
  public static calculateAngularError(
    heading: number,
    bearing: number
  ): number {
    const delta = Math.abs(heading - bearing) % 360;
    return Math.min(delta, 360 - delta);
  }

  /**
   * Computes Heading Score (0 - 100).
   * - undefined heading or speed < 2 km/h => 50 (neutral)
   * - error <= 30 deg => 100
   * - error <= 75 deg => 70
   * - error <= 120 deg => 40
   * - error > 120 deg => 15
   */
  public static computeHeadingScore(
    driverCoords: [number, number],
    pickupCoords: [number, number],
    heading?: number,
    speed?: number
  ): { headingScore: number; angularError: number } {
    if (heading === undefined || heading === null || (speed !== undefined && speed < 2)) {
      return { headingScore: 50, angularError: 0 };
    }

    const bearing = this.calculateBearing(driverCoords, pickupCoords);
    const angularError = this.calculateAngularError(heading, bearing);

    let headingScore = 50;
    if (angularError <= 30) {
      headingScore = 100;
    } else if (angularError <= 75) {
      headingScore = 70;
    } else if (angularError <= 120) {
      headingScore = 40;
    } else {
      headingScore = 15;
    }

    return { headingScore, angularError };
  }

  /**
   * Returns base assumed speed (km/h) by vehicle type.
   */
  public static getVehicleBaseSpeedKmh(vehicleType: string): number {
    const v = vehicleType.toLowerCase();
    if (v === 'bajaj') return 20;
    if (v === 'car' || v === 'van') return 25;
    if (v === 'truck') return 20;
    return 25;
  }

  /**
   * Computes predicted ETA (minutes) and ETA Score (0 - 100).
   * Formula:
   * S_ETA = max(0, min(100, 100 - (T_estimated * 5)))
   */
  public static computeEtaScore(
    distanceKm: number,
    vehicleType: string,
    angularError: number,
    isMoving: boolean
  ): { etaMinutes: number; etaScore: number } {
    const speed = this.getVehicleBaseSpeedKmh(vehicleType);
    let tBase = (distanceKm / speed) * 60; // in minutes

    // If heading away (> 120 deg) and moving, apply turning/rerouting penalty
    if (isMoving && angularError > 120) {
      tBase += 1.5;
    }

    const etaMinutes = Math.max(0.5, Math.round(tBase * 10) / 10);
    const etaScore = Math.max(0, Math.min(100, Math.round(100 - (etaMinutes * 5))));

    return { etaMinutes, etaScore };
  }

  /**
   * Computes Landmark Familiarity Score (10, 40, 75, 100).
   */
  public static computeLandmarkScore(completedDeliveries?: number): number {
    const count = completedDeliveries || 0;
    if (count <= 0) return 10;
    if (count < 5) return 40;
    if (count < 20) return 75;
    return 100;
  }

  /**
   * Computes Idle-Time Fairness Score (20, 50, 80, 100).
   */
  public static computeIdleScore(
    lastDutyToggleAt?: Date | number,
    nowMs: number = Date.now()
  ): number {
    if (!lastDutyToggleAt) return 50; // Default reasonable middle ground if unknown

    const toggleMs =
      typeof lastDutyToggleAt === 'number'
        ? lastDutyToggleAt
        : new Date(lastDutyToggleAt).getTime();

    const idleMinutes = Math.max(0, (nowMs - toggleMs) / 60000);

    if (idleMinutes <= 5) return 20;
    if (idleMinutes <= 15) return 50;
    if (idleMinutes <= 30) return 80;
    return 100;
  }

  /**
   * Computes Acceptance Rate Score (0 - 100).
   */
  public static computeAcceptanceScore(
    totalOffersReceived?: number,
    totalOffersAccepted?: number
  ): number {
    const received = totalOffersReceived || 0;
    const accepted = totalOffersAccepted || 0;

    if (received < 3) {
      // New driver baseline
      return 85;
    }

    const rate = Math.min(1, Math.max(0, accepted / received));
    return Math.round(rate * 100);
  }

  /**
   * Computes Expected Assignment Time Score (0 - 100).
   * EAT = Estimated Effective ETA + (1 - P_accept) * T_timeout
   */
  public static computeEatScore(
    etaMinutes: number,
    acceptanceRate: number,
    isChained: boolean = false,
    remainingActiveMinutes: number = 0
  ): { eatMinutes: number; eatScore: number } {
    const roundTimeoutMinutes = 0.25; // 15 seconds
    const pAccept = Math.max(0.1, Math.min(1.0, acceptanceRate));

    const effectiveEta = isChained ? (remainingActiveMinutes + etaMinutes) : etaMinutes;
    const eatMinutes = Math.round((effectiveEta + (1 - pAccept) * roundTimeoutMinutes) * 10) / 10;

    // S_EAT decays as assignment time exceeds 10 minutes
    const eatScore = Math.max(0, Math.min(100, Math.round(100 - (eatMinutes * 5))));
    return { eatMinutes, eatScore };
  }

  /**
   * Computes Trust/Rating Score (0 - 100).
   * Defaults to 90 (or 4.5/5) if rating is not provided.
   */
  public static computeTrustScore(rating?: number): number {
    if (rating === undefined || rating === null) return 90;
    // Rating between 1 and 5 -> normalized to 20 - 100
    const clamped = Math.max(1, Math.min(5, rating));
    return Math.round((clamped / 5) * 100);
  }

  /**
   * Scores a single candidate driver against a pickup location.
   */
  public static scoreCandidate(
    candidate: CandidateDriverInput,
    pickupCoords: [number, number],
    nowMs: number = Date.now()
  ): CandidateScoreResult {
    const distanceKm = this.haversineDistanceKm(candidate.coordinates, pickupCoords);
    const isMoving = candidate.speed !== undefined && candidate.speed >= 2;

    const { headingScore, angularError } = this.computeHeadingScore(
      candidate.coordinates,
      pickupCoords,
      candidate.heading,
      candidate.speed
    );

    const { etaMinutes, etaScore } = this.computeEtaScore(
      distanceKm,
      candidate.vehicleType,
      angularError,
      isMoving
    );

    const landmarkScore = this.computeLandmarkScore(candidate.completedLandmarkDeliveries);
    const idleScore = this.computeIdleScore(candidate.lastDutyToggleAt, nowMs);
    const acceptanceScore = this.computeAcceptanceScore(
      candidate.totalOffersReceived,
      candidate.totalOffersAccepted
    );

    const acceptanceRateDecimal = acceptanceScore / 100;
    const { eatMinutes, eatScore } = this.computeEatScore(
      etaMinutes,
      acceptanceRateDecimal,
      candidate.isChained || false,
      candidate.activeOrderRemainingMinutes || 0
    );

    const trustScore = this.computeTrustScore(candidate.rating);

    // Phase 4 Composite Score:
    // Score = 0.30 * S_EAT + 0.20 * S_Landmark + 0.15 * S_Heading + 0.15 * S_Idle + 0.10 * S_Acceptance + 0.10 * S_Trust
    const composite =
      0.30 * eatScore +
      0.20 * landmarkScore +
      0.15 * headingScore +
      0.15 * idleScore +
      0.10 * acceptanceScore +
      0.10 * trustScore;

    const finalScore = Math.round(composite * 100) / 100;

    return {
      driverId: candidate.driverId,
      score: finalScore,
      distanceKm: Math.round(distanceKm * 100) / 100,
      etaMinutes,
      scoreBreakdown: {
        etaMinutes,
        etaScore,
        eatMinutes,
        eatScore,
        landmarkScore,
        headingScore,
        idleScore,
        acceptanceScore,
        trustScore,
      },
    };
  }

  /**
   * Ranks candidates deterministically in descending order of composite score.
   * If two candidates have identical scores, breaks ties by lower distance, then driverId.
   */
  public static rankCandidates(
    candidates: CandidateDriverInput[],
    pickupCoords: [number, number],
    nowMs: number = Date.now()
  ): CandidateScoreResult[] {
    const scored = candidates.map(c => this.scoreCandidate(c, pickupCoords, nowMs));

    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return a.driverId.localeCompare(b.driverId);
    });

    return scored;
  }
}
