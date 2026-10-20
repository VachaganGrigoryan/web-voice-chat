import { afterEach, describe, expect, it, vi } from 'vitest';
import { pushSupported, toTokenPayload, urlBase64ToUint8Array } from './push';

// 65-byte uncompressed P-256 point (0x04 prefix) as url-safe base64 without padding.
const KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-ib37J8xQmrIXB4o0JNjSmbQbMFcMo8bQ3Yo4yDhaqb2ZdQHGBbFw7bZ4YI8';

afterEach(() => vi.unstubAllGlobals());

describe('urlBase64ToUint8Array', () => {
  it('decodes a 65-byte VAPID key', () => {
    const bytes = urlBase64ToUint8Array(KEY);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBe(65);
    expect(bytes[0]).toBe(0x04);
  });
});

describe('toTokenPayload', () => {
  it('serializes the subscription JSON as the token', () => {
    const json = { endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } };
    const payload = toTokenPayload({ toJSON: () => json } as unknown as PushSubscription, 'dev-1');
    expect(payload).toEqual({ platform: 'web', token: JSON.stringify(json), device_id: 'dev-1' });
  });
});

describe('pushSupported', () => {
  it('is false without PushManager', () => {
    vi.stubGlobal('window', {});
    expect(pushSupported()).toBe(false);
  });
  it('is true with serviceWorker, PushManager and Notification', () => {
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    vi.stubGlobal('navigator', { serviceWorker: {} });
    expect(pushSupported()).toBe(true);
  });
});
