import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isExpoPushToken,
  buildPushMessage,
  isDeviceNotRegistered,
} from './services/notificationService';

describe('I10: Expo push token detection', () => {
  it('accepts valid Expo push tokens', () => {
    assert.equal(isExpoPushToken('ExponentPushToken[xyz123]'), true);
  });

  it('rejects native FCM/APNs tokens (getDevicePushTokenAsync output)', () => {
    assert.equal(isExpoPushToken('APA91bFakeFcmTokenHere'), false);
    assert.equal(isExpoPushToken('fcm-token-0123456789'), false);
    assert.equal(isExpoPushToken(undefined), false);
  });
});

describe('I10: push message construction', () => {
  it('builds a high-priority message with data payload', () => {
    const msg = buildPushMessage('ExponentPushToken[a]', 'Title', 'Body', { type: 'IMPORT_STATUS', importId: 'id1' });
    assert.equal(msg.to, 'ExponentPushToken[a]');
    assert.equal(msg.title, 'Title');
    assert.equal(msg.body, 'Body');
    assert.equal(msg.priority, 'high');
    assert.equal(msg.sound, 'default');
    assert.equal(msg.channelId, 'default');
    assert.deepStrictEqual(msg.data, { type: 'IMPORT_STATUS', importId: 'id1' });
  });

  it('defaults data to an empty object', () => {
    const msg = buildPushMessage('ExponentPushToken[a]', 't', 'b');
    assert.deepStrictEqual(msg.data, {});
  });
});

describe('I10: device-not-registered handling (token retirement)', () => {
  it('marks DeviceNotRegistered tickets for token drop', () => {
    assert.equal(
      isDeviceNotRegistered({ status: 'error', message: 'bad', details: { error: 'DeviceNotRegistered' } }),
      true
    );
  });

  it('does not drop on success or unrelated errors', () => {
    assert.equal(isDeviceNotRegistered({ status: 'ok', id: 'ticket1' }), false);
    assert.equal(
      isDeviceNotRegistered({ status: 'error', message: 'big', details: { error: 'MessageTooBig' } }),
      false
    );
    assert.equal(isDeviceNotRegistered(undefined), false);
  });
});
