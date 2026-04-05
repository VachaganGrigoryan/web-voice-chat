export interface CallPreferredDeviceIds {
  microphoneId: string | null;
  cameraId: string | null;
  audioRouteId: string | null;
}

const CALL_DEVICE_PREFERENCES_STORAGE_KEY = 'voca.call-device-preferences';

const defaultCallPreferredDeviceIds: CallPreferredDeviceIds = {
  microphoneId: null,
  cameraId: null,
  audioRouteId: null,
};

const canUseLocalStorage = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const sanitizeStoredPreference = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value : null;

export const readCallDevicePreferences = (): CallPreferredDeviceIds => {
  if (!canUseLocalStorage()) {
    return defaultCallPreferredDeviceIds;
  }

  try {
    const rawValue = window.localStorage.getItem(CALL_DEVICE_PREFERENCES_STORAGE_KEY);
    if (!rawValue) {
      return defaultCallPreferredDeviceIds;
    }

    const parsedValue = JSON.parse(rawValue) as Partial<CallPreferredDeviceIds> | null;
    return {
      microphoneId: sanitizeStoredPreference(parsedValue?.microphoneId),
      cameraId: sanitizeStoredPreference(parsedValue?.cameraId),
      audioRouteId: sanitizeStoredPreference(parsedValue?.audioRouteId),
    };
  } catch {
    return defaultCallPreferredDeviceIds;
  }
};

export const writeCallDevicePreferences = (
  patch: Partial<CallPreferredDeviceIds>
): CallPreferredDeviceIds => {
  const nextValue = {
    ...readCallDevicePreferences(),
    ...patch,
  };

  if (!canUseLocalStorage()) {
    return nextValue;
  }

  try {
    window.localStorage.setItem(
      CALL_DEVICE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(nextValue)
    );
  } catch {
    // Ignore storage failures so calls can still continue with in-memory state.
  }

  return nextValue;
};
