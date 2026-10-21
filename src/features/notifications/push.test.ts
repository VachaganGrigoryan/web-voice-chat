import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  pushSupported,
  sameOriginTarget,
  shouldRaisePageNotification,
  toTokenPayload,
  unsubscribeLocally,
  urlBase64ToUint8Array,
} from './push';

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

describe('sameOriginTarget', () => {
  const o = 'http://localhost:3000';
  it('rebases a foreign absolute url onto the app origin', () => {
    expect(sameOriginTarget('https://evil.example/c/1?x=2#m', o)).toBe('http://localhost:3000/c/1?x=2#m');
  });
  it('resolves relative urls', () => {
    expect(sameOriginTarget('/chat/5', o)).toBe('http://localhost:3000/chat/5');
  });
  it('falls back to root when missing or invalid', () => {
    expect(sameOriginTarget(undefined, o)).toBe('http://localhost:3000/');
    expect(sameOriginTarget(42, o)).toBe('http://localhost:3000/');
    expect(sameOriginTarget(null, o)).toBe('http://localhost:3000/');
    expect(sameOriginTarget('http://[bad', o)).toBe('http://localhost:3000/');
  });
});

describe('shouldRaisePageNotification', () => {
  it('defers to push only for alerts the server also pushes', () => {
    expect(shouldRaisePageNotification('granted', false, true)).toBe(true);
    expect(shouldRaisePageNotification('granted', true, true)).toBe(false);
    expect(shouldRaisePageNotification('denied', false, true)).toBe(false);
    expect(shouldRaisePageNotification('default', false, true)).toBe(false);
  });

  it('always raises alerts push never carries, such as calls', () => {
    expect(shouldRaisePageNotification('granted', true, false)).toBe(true);
    expect(shouldRaisePageNotification('denied', true, false)).toBe(false);
  });
});

describe('unsubscribeLocally', () => {
  const supported = (getRegistration: () => Promise<unknown>) => {
    vi.stubGlobal('window', { PushManager: class {}, Notification: class {} });
    vi.stubGlobal('navigator', { serviceWorker: { getRegistration } });
  };

  it('unsubscribes the current subscription', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    supported(() =>
      Promise.resolve({ pushManager: { getSubscription: () => Promise.resolve({ unsubscribe }) } })
    );
    await unsubscribeLocally();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('resolves without a registration, on errors and without push support', async () => {
    supported(() => Promise.resolve(undefined));
    await expect(unsubscribeLocally()).resolves.toBeUndefined();
    supported(() => Promise.reject(new Error('boom')));
    await expect(unsubscribeLocally()).resolves.toBeUndefined();
    vi.stubGlobal('window', {});
    await expect(unsubscribeLocally()).resolves.toBeUndefined();
  });
});
