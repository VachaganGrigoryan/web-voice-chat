import { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '@/api/endpoints';
import {
  currentSubscription,
  pushSupported,
  resyncPushSubscription,
  toTokenPayload,
  urlBase64ToUint8Array,
} from './push';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
const DEVICE_ID_KEY = 'push_device_id';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'web-unknown';
  }
}

/** Best-effort and non-hook so logout can call it; resolves even when the server call fails. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  try {
    const sub = await currentSubscription();
    if (!sub) return;
    const { token } = toTokenPayload(sub, '');
    await sub.unsubscribe();
    await notificationsApi.deletePushToken(token);
  } catch (err) {
    console.warn('Push: disable failed', err);
  }
}

/** Non-hook so the signed-in shell can call it once on load; never rejects. */
export async function resyncPush(): Promise<void> {
  if (!pushSupported() || !VAPID_PUBLIC_KEY) return;
  await resyncPushSubscription({
    current: currentSubscription,
    permission: () => Notification.permission,
    register: notificationsApi.registerPushToken,
    deviceId: getDeviceId(),
  });
}

export function usePushSubscription() {
  const supported = pushSupported() && !!VAPID_PUBLIC_KEY;
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!supported) return;
    currentSubscription()
      .then((sub) => setEnabled(!!sub && Notification.permission === 'granted'))
      .catch(() => setEnabled(false));
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported) return;
    if ((await Notification.requestPermission()) !== 'granted') return;
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
    try {
      await notificationsApi.registerPushToken(toTokenPayload(sub, getDeviceId()));
    } catch (err) {
      await sub.unsubscribe().catch(() => undefined);
      throw err;
    }
    setEnabled(true);
  }, [supported]);

  const disable = useCallback(async () => {
    await disablePush();
    setEnabled(false);
  }, []);

  return { supported, enabled, enable, disable };
}
