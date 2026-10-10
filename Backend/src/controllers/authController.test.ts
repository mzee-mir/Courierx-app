import { describe, it } from 'node:test';
import assert from 'node:assert';
import { isSelfAssignableRole, SELF_ASSIGNABLE_ROLES } from './authController';

describe('isSelfAssignableRole (I2: privilege escalation prevention)', () => {
  it('allows customer role', () => {
    assert.equal(isSelfAssignableRole('customer'), true);
  });

  it('allows driver role', () => {
    assert.equal(isSelfAssignableRole('driver'), true);
  });

  it('rejects super_admin', () => {
    assert.equal(isSelfAssignableRole('super_admin'), false);
  });

  it('rejects all admin/partner roles', () => {
    for (const role of ['ops_admin', 'finance_admin', 'support_admin', 'partner_owner', 'partner_ops', 'partner_readonly', 'merchant']) {
      assert.equal(isSelfAssignableRole(role), false, `${role} must not be self-assignable`);
    }
  });

  it('rejects garbage/unknown roles', () => {
    assert.equal(isSelfAssignableRole('bogus_role'), false);
    assert.equal(isSelfAssignableRole(''), false);
  });

  it('whitelist contains only customer and driver', () => {
    assert.deepEqual(SELF_ASSIGNABLE_ROLES.sort(), ['customer', 'driver']);
  });
});
