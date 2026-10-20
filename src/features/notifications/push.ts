export function urlBase64ToUint8Array(key: string): Uint8Array {
  const padded = key + '='.repeat((4 - (key.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export function toTokenPayload(sub: PushSubscription, deviceId: string) {
  return { platform: 'web' as const, token: JSON.stringify(sub.toJSON()), device_id: deviceId };
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/** Same-origin absolute URL for a push click; anything foreign, relative-invalid or missing falls back to the root. */
export function sameOriginTarget(raw: unknown, origin: string): string {
  try {
    const u = new URL(typeof raw === 'string' ? raw : '', origin);
    return new URL(u.pathname + u.search + u.hash, origin).href;
  } catch {
    return new URL('/', origin).href;
  }
}
