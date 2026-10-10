import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  MANIFEST_FSM,
  ManifestStatus,
  validateImportTransition,
  IMPORT_FSM,
} from './config/stateMachine';
import { ImportStatus } from './models/ImportRequest';
import { UserRole } from './models/User';

/**
 * GAP 5 hardening tests.
 * Phase 6 closed M2 bypasses by validating manifest/import transitions against the
 * authoritative FSMs before any state write. These tests lock that behavior in.
 */

describe('MANIFEST_FSM hardening (M2 bypass closure)', () => {
  it('rejects illegal DRAFT -> DEPARTED skip', () => {
    const allowed = MANIFEST_FSM[ManifestStatus.DRAFT];
    assert.ok(!allowed.includes(ManifestStatus.DEPARTED));
  });

  it('rejects illegal DEPARTED -> DISMANTLED skip', () => {
    const allowed = MANIFEST_FSM[ManifestStatus.DEPARTED];
    assert.ok(!allowed.includes(ManifestStatus.DISMANTLED));
  });

  it('allows the canonical chain DRAFT->CONSOLIDATED->DEPARTED->ARRIVED->DISMANTLED', () => {
    const chain = [
      ManifestStatus.DRAFT,
      ManifestStatus.CONSOLIDATED,
      ManifestStatus.DEPARTED,
      ManifestStatus.ARRIVED,
      ManifestStatus.DISMANTLED,
    ];
    for (let i = 1; i < chain.length; i++) {
      assert.ok(MANIFEST_FSM[chain[i - 1]].includes(chain[i]), `blocked ${chain[i - 1]} -> ${chain[i]}`);
    }
  });

  it('arrived manifests may only dismantle (finalize requires ARRIVED)', () => {
    assert.deepStrictEqual(MANIFEST_FSM[ManifestStatus.ARRIVED], [ManifestStatus.DISMANTLED]);
  });

  it('terminal states have no outgoing transitions', () => {
    assert.deepStrictEqual(MANIFEST_FSM[ManifestStatus.DISMANTLED], []);
  });
});

describe('validateImportTransition (authority + data integrity engine)', () => {
  const shipment = {
    status: ImportStatus.RECEIVED_AT_ORIGIN,
    currentLocationId: 'locA',
    intake_weight: 12,
    transportMode: 'AIR',
    isFlagged: false,
  };

  it('blocks a user without custody authority', () => {
    const outsider = { roles: [UserRole.OPS_ADMIN], assignedLocations: ['locB'] };
    assert.throws(() => validateImportTransition(shipment, ImportStatus.CONSOLIDATED, outsider), /AUTHORITY_VIOLATION/);
  });

  it('allows a user with custody over the shipment location', () => {
    const custodian = { roles: [UserRole.OPS_ADMIN], assignedLocations: ['locA'] };
    assert.equal(validateImportTransition(shipment, ImportStatus.CONSOLIDATED, custodian), true);
  });

  it('allows super_admin regardless of custody', () => {
    const superAdmin = { roles: [UserRole.SUPER_ADMIN], assignedLocations: [] };
    assert.equal(validateImportTransition(shipment, ImportStatus.CONSOLIDATED, superAdmin), true);
  });

  it('freezes flagged shipments (exception lock)', () => {
    const flagged = { ...shipment, isFlagged: true };
    const custodian = { roles: [UserRole.OPS_ADMIN], assignedLocations: ['locA'] };
    assert.throws(() => validateImportTransition(flagged, ImportStatus.CONSOLIDATED, custodian), /FSM_VIOLATION/);
  });

  it('blocks ARRIVED_LOCAL when intake weight was never captured', () => {
    const noWeight = { ...shipment, intake_weight: undefined };
    const custodian = { roles: [UserRole.SUPER_ADMIN], assignedLocations: [] };
    assert.throws(() => validateImportTransition(noWeight, ImportStatus.ARRIVED_LOCAL, custodian), /DATA_INTEGRITY_FAILURE/);
  });

  it('rejects a transition not in IMPORT_FSM', () => {
    const custodian = { roles: [UserRole.OPS_ADMIN], assignedLocations: ['locA'] };
    assert.throws(() => validateImportTransition(shipment, ImportStatus.DELIVERED, custodian), /FSM_VIOLATION/);
  });

  it('rejects overweight air freight', () => {
    const heavy = { ...shipment, intake_weight: 40, transportMode: 'AIR' };
    const custodian = { roles: [UserRole.SUPER_ADMIN], assignedLocations: [] };
    assert.throws(() => validateImportTransition(heavy, ImportStatus.CONSOLIDATED, custodian), /MODAL_VIOLATION/);
  });
});

describe('IMPORT_FSM completeness (model enum coverage)', () => {
  it('every ImportStatus has an FSM entry', () => {
    const allStatuses = Object.values(ImportStatus);
    for (const s of allStatuses) {
      assert.ok(IMPORT_FSM[s as ImportStatus], `missing FSM entry for ${s}`);
    }
  });
});