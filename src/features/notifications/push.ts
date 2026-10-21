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

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return reg ? reg.pushManager.getSubscription() : null;
}

/**
 * Re-sends this browser's existing subscription so the server's copy stays current (and newest,
 * so the per-user token cap never evicts it). Resolves `true` only when it was registered; never rejects.
 */
export async function resyncPushSubscription(deps: {
  current: () => Promise<PushSubscription | null>;
  permission: () => NotificationPermission;
  register: (payload: ReturnType<typeof toTokenPayload>) => Promise<void>;
  deviceId: string;
}): Promise<boolean> {
  try {
    if (deps.permission() !== 'granted') return false;
    const sub = await deps.current();
    if (!sub) return false;
    await deps.register(toTokenPayload(sub, deps.deviceId));
    return true;
  } catch (err) {
    console.warn('Push: resync failed', err);
    return false;
  }
}

/** Drops this browser's subscription without the server, which prunes the token on its next send; never rejects. */
export async function unsubscribeLocally(): Promise<void> {
  try {
    await (await currentSubscription())?.unsubscribe();
  } catch {
    // Best effort: logout must not depend on it.
  }
}

/**
 * A subscribed browser gets the OS notification from the service worker, so the page raises none —
 * but only for alerts the server pushes (messages); calls are never pushed and always raise here.
 */
export function shouldRaisePageNotification(
  permission: string,
  pushSubscribed: boolean,
  pushCovered: boolean,
): boolean {
  return permission === 'granted' && !(pushCovered && pushSubscribed);
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
