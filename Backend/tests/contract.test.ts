import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app';

/**
 * API CONTRACT TESTS
 * Boot the real Express app (src/app.ts) against an in-memory MongoDB and assert
 * the public HTTP contract: health, idempotency guard, auth guards, and the
 * self-assignable role guard (I2) enforced through the live stack.
 */
let mongo: MongoMemoryServer;

before(async () => {
  // Explicit override for CI/local setups with a disposable MongoDB.
  const externalUri = process.env.CONTRACT_TEST_MONGODB_URI;
  if (externalUri) {
    await mongoose.connect(externalUri);
    return;
  }
  try {
    // Spawns a real mongod from the cached binary. The first run downloads the
    // MongoDB binary (~781MB) into ~/.cache/mongodb-binaries and can take a
    // while; subsequent runs reuse the cache.
    mongo = await MongoMemoryServer.create();
  } catch (err: any) {
    throw new Error(
      'Contract tests need a MongoDB but the in-memory server could not start. ' +
      'Provision the binary once, or point CONTRACT_TEST_MONGODB_URI at a disposable database. ' +
      `Underlying error: ${err?.message ?? err}`
    );
  }
  await mongoose.connect(mongo.getUri());
});

after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

describe('Contract: /health', () => {
  it('returns healthy status with a request trace id', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
    assert.ok(res.body.traceId, 'expected a requestId in the payload');
    assert.ok(res.headers['x-request-id'], 'expected X-Request-ID header');
  });
});

describe('Contract: idempotency guard (mutation endpoints)', () => {
  it('rejects POST /auth/verify without X-Idempotency-Key', async () => {
    const res = await request(app).post('/api/v1/auth/verify').send({});
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'IDEMPOTENCY_KEY_REQUIRED');
  });

  it('does not require an idempotency key for GET /health', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
  });
});

describe('Contract: auth/verify input validation', () => {
  it('rejects missing identity token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify')
      .set('X-Idempotency-Key', 'contract-test-1')
      .send({});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /INVALID_REQUEST/);
  });

  it('rejects privileged role requests through the public verify endpoint (I2)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify')
      .set('X-Idempotency-Key', 'contract-test-2')
      .send({ idToken: 'fake-token', appRole: 'super_admin' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'INVALID_ROLE_REQUEST');
  });
});

describe('Contract: protected resources', () => {
  it('rejects unauthenticated access to /orders', async () => {
    const res = await request(app).get('/api/v1/orders');
    assert.equal(res.status, 401);
  });

  it('rejects unauthenticated access to /admin routes', async () => {
    const res = await request(app).get('/api/v1/admin/finance/withdrawals');
    assert.equal(res.status, 401);
  });
});

describe('Contract: unknown routes', () => {
  it('returns 404 for undefined endpoints', async () => {
    const res = await request(app).get('/api/v1/this-does-not-exist');
    assert.equal(res.status, 404);
  });
});
