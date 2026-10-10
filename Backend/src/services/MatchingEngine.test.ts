import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MatchingEngine, CandidateDriverInput } from './MatchingEngine';

describe('MatchingEngine (Deterministic Scoring & Ranking Engine)', () => {
  const pickupCoords: [number, number] = [45.3182, 2.0469]; // Mogadishu center

  it('calculates forward bearing and angular error accurately', () => {
    // A point directly North of pickup: same lng, higher lat
    const northOfPickup: [number, number] = [45.3182, 2.0569];
    // Bearing from northOfPickup to pickup is South (180 degrees)
    const bearingToPickup = MatchingEngine.calculateBearing(northOfPickup, pickupCoords);
    assert.ok(Math.abs(bearingToPickup - 180) < 1, `Expected ~180 deg, got ${bearingToPickup}`);

    // If driver is at northOfPickup and heading South (180 deg), angular error is 0
    const errTowards = MatchingEngine.calculateAngularError(180, bearingToPickup);
    assert.ok(errTowards < 1, `Expected ~0 deg error, got ${errTowards}`);

    // If driver is heading North (0 deg), angular error is 180 (moving away)
    const errAway = MatchingEngine.calculateAngularError(0, bearingToPickup);
    assert.ok(Math.abs(errAway - 180) < 1, `Expected ~180 deg error, got ${errAway}`);
  });

  it('scores heading vector according to specification thresholds', () => {
    const northOfPickup: [number, number] = [45.3182, 2.0569];

    // 1. Moving directly towards pickup (heading 180, speed 20) -> Score 100
    const scoreTowards = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      180,
      20
    );
    assert.strictEqual(scoreTowards.headingScore, 100);

    // 2. Heading within 30 deg -> Score 100
    const scoreClose = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      195, // 15 deg error
      20
    );
    assert.strictEqual(scoreClose.headingScore, 100);

    // 3. Heading within 75 deg (e.g. 50 deg error) -> Score 70
    const scoreModerate = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      230, // 50 deg error
      20
    );
    assert.strictEqual(scoreModerate.headingScore, 70);

    // 4. Heading within 120 deg (e.g. 100 deg error) -> Score 40
    const scoreOff = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      280, // 100 deg error
      20
    );
    assert.strictEqual(scoreOff.headingScore, 40);

    // 5. Heading directly away (heading 0 deg -> 180 deg error) -> Score 15
    const scoreAway = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      0,
      20
    );
    assert.strictEqual(scoreAway.headingScore, 15);

    // 6. Stationary driver (speed < 2 km/h) -> Score 50 (neutral)
    const scoreStationary = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      0,
      1.5
    );
    assert.strictEqual(scoreStationary.headingScore, 50);

    // 7. Undefined heading -> Score 50 (neutral)
    const scoreNoHeading = MatchingEngine.computeHeadingScore(
      northOfPickup,
      pickupCoords,
      undefined,
      20
    );
    assert.strictEqual(scoreNoHeading.headingScore, 50);
  });

  it('computes landmark familiarity scores correctly', () => {
    assert.strictEqual(MatchingEngine.computeLandmarkScore(0), 10);
    assert.strictEqual(MatchingEngine.computeLandmarkScore(3), 40);
    assert.strictEqual(MatchingEngine.computeLandmarkScore(10), 75);
    assert.strictEqual(MatchingEngine.computeLandmarkScore(25), 100);
  });

  it('computes idle-time fairness scores correctly', () => {
    const now = Date.now();
    // 3 minutes idle
    assert.strictEqual(MatchingEngine.computeIdleScore(now - 3 * 60000, now), 20);
    // 10 minutes idle
    assert.strictEqual(MatchingEngine.computeIdleScore(now - 10 * 60000, now), 50);
    // 25 minutes idle
    assert.strictEqual(MatchingEngine.computeIdleScore(now - 25 * 60000, now), 80);
    // 45 minutes idle
    assert.strictEqual(MatchingEngine.computeIdleScore(now - 45 * 60000, now), 100);
  });

  it('computes acceptance rate scores correctly with new driver baseline', () => {
    // New driver (< 3 offers) defaults to 85
    assert.strictEqual(MatchingEngine.computeAcceptanceScore(0, 0), 85);
    assert.strictEqual(MatchingEngine.computeAcceptanceScore(2, 2), 85);

    // Established driver: 8/10 = 80%
    assert.strictEqual(MatchingEngine.computeAcceptanceScore(10, 8), 80);
    // Established driver: 5/10 = 50%
    assert.strictEqual(MatchingEngine.computeAcceptanceScore(10, 5), 50);
  });

  it('deterministically ranks candidates: Driver B (familiar, approaching) beats Driver A (moving away)', () => {
    const now = Date.now();

    // Driver A: 1.2 km away, moving AWAY from pickup (heading 0 deg), 0 landmark trips, low idle time
    const driverA: CandidateDriverInput = {
      driverId: 'driver_A',
      coordinates: [45.3182, 2.0577], // ~1.2 km North
      heading: 0, // heading North (away from pickup)
      speed: 25,
      vehicleType: 'car',
      completedLandmarkDeliveries: 0,
      lastDutyToggleAt: now - 4 * 60000, // 4 mins idle
      totalOffersReceived: 10,
      totalOffersAccepted: 5, // 50% acceptance
    };

    // Driver B: 1.5 km away, moving TOWARDS pickup (heading 180 deg), 15 landmark trips, high idle time
    const driverB: CandidateDriverInput = {
      driverId: 'driver_B',
      coordinates: [45.3182, 2.0604], // ~1.5 km North
      heading: 180, // heading South (directly towards pickup)
      speed: 25,
      vehicleType: 'car',
      completedLandmarkDeliveries: 15,
      lastDutyToggleAt: now - 35 * 60000, // 35 mins idle
      totalOffersReceived: 10,
      totalOffersAccepted: 9, // 90% acceptance
    };

    const ranked = MatchingEngine.rankCandidates([driverA, driverB], pickupCoords, now);

    assert.strictEqual(ranked.length, 2);
    assert.strictEqual(
      ranked[0].driverId,
      'driver_B',
      `Driver B should rank #1 despite slightly larger distance, got ${ranked[0].driverId}`
    );
    assert.ok(
      ranked[0].score > ranked[1].score,
      `Driver B score (${ranked[0].score}) must exceed Driver A score (${ranked[1].score})`
    );
  });
});
