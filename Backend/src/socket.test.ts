import { describe, it } from 'node:test';
import assert from 'node:assert';
import { hasAdminRole, isDriverRole, SosRateLimiter, ADMIN_ROLES } from './socket';
import { UserRole } from './models/User';

describe('M4b: admin god-view room membership', () => {
  it('grants every admin role access to the god view', () => {
    for (const role of ADMIN_ROLES) {
      assert.equal(hasAdminRole([role]), true, `expected ${role} to be admin`);
    }
  });

  it('never grants customers, drivers, or partner staff the god view', () => {
    assert.equal(hasAdminRole([UserRole.CUSTOMER]), false);
    assert.equal(hasAdminRole([UserRole.DRIVER]), false);
    assert.equal(hasAdminRole([UserRole.PARTNER_OWNER]), false);
    assert.equal(hasAdminRole([UserRole.PARTNER_OPS]), false);
    assert.equal(hasAdminRole([]), false);
  });

  it('matches any admin role in a multi-role array (intersection, not literal "admin")', () => {
    assert.equal(hasAdminRole([UserRole.DRIVER, UserRole.OPS_ADMIN]), true);
    assert.equal(hasAdminRole(['customer', 'driver']), false);
  });
});

describe('M4c: emergency_sos driver gate', () => {
  it('allows drivers only', () => {
    assert.equal(isDriverRole([UserRole.DRIVER]), true);
    assert.equal(isDriverRole([UserRole.CUSTOMER]), false);
    assert.equal(isDriverRole([UserRole.OPS_ADMIN]), false);
    assert.equal(isDriverRole([]), false);
  });
});

describe('M4c: SOS rate limiter', () => {
  it('allows up to the configured max in a window', () => {
    const limiter = new SosRateLimiter(3, 60_000);
    assert.equal(limiter.allow('u1'), true);
    assert.equal(limiter.allow('u1'), true);
    assert.equal(limiter.allow('u1'), true);
    assert.equal(limiter.allow('u1'), false);
  });

  it('tracks users independently', () => {
    const limiter = new SosRateLimiter(1, 60_000);
    assert.equal(limiter.allow('u1'), true);
    assert.equal(limiter.allow('u1'), false);
    assert.equal(limiter.allow('u2'), true);
  });

  it('resets after the window elapses', async () => {
    const limiter = new SosRateLimiter(1, 25);
    assert.equal(limiter.allow('u1'), true);
    assert.equal(limiter.allow('u1'), false);
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(limiter.allow('u1'), true);
  });
});
