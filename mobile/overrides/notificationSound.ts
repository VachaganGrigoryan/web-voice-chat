import { create } from 'zustand';
import { toast } from 'sonner';
import { androidNotifications } from '../plugins/androidNotifications';

export type SoundCapability = 'unknown' | 'enabled' | 'blocked' | 'unsupported' | 'error';
export type BrowserNotificationState = NotificationPermission | 'unsupported';

interface NotificationSoundState {
  soundEnabled: boolean;
  soundCapability: SoundCapability;
  browserNotificationState: BrowserNotificationState;
  soundPromptDismissed: boolean;
  isEnablingSound: boolean;
  isRequestingBrowserNotifications: boolean;
  init: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  enableSoundFromUserGesture: () => Promise<boolean>;
  resumeSoundFromRememberedGesture: () => Promise<boolean>;
  playIncomingMessageCue: () => Promise<boolean>;
  requestBrowserNotifications: () => Promise<BrowserNotificationState>;
  dismissSoundPrompt: () => void;
  resetSoundPrompt: () => void;
  syncBrowserNotificationState: () => BrowserNotificationState;
}

interface SendNotificationOptions {
  playInAppCue?: boolean;
  withSound?: boolean;
}

const SOUND_ENABLED_STORAGE_KEY = 'soundEnabled';

const readSoundEnabledPreference = () => {
  if (typeof window === 'undefined') {
    return true;
  }

  return window.localStorage.getItem(SOUND_ENABLED_STORAGE_KEY) !== 'false';
};

const persistSoundEnabledPreference = (enabled: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SOUND_ENABLED_STORAGE_KEY, String(enabled));
};

const mapPermissionState = (
  permissionState: Awaited<ReturnType<typeof androidNotifications.checkPermissions>>['notifications'],
): BrowserNotificationState => {
  switch (permissionState) {
    case 'granted':
      return 'granted';
    case 'denied':
      return 'denied';
    case 'prompt':
    case 'prompt-with-rationale':
      return 'default';
    default:
      return 'unsupported';
  }
};

const deriveSoundCapability = (
  soundEnabled: boolean,
  notificationState: BrowserNotificationState,
): SoundCapability => {
  if (!androidNotifications.isNativeAndroid) {
    return 'unsupported';
  }

  if (!soundEnabled) {
    return 'enabled';
  }

  switch (notificationState) {
    case 'granted':
      return 'enabled';
    case 'denied':
      return 'error';
    case 'unsupported':
      return 'unsupported';
    default:
      return 'unknown';
  }
};

const applyNotificationState = (notificationState: BrowserNotificationState) => {
  useNotificationSoundStore.setState((state) => ({
    browserNotificationState: notificationState,
    soundCapability: deriveSoundCapability(state.soundEnabled, notificationState),
  }));

  return notificationState;
};

async function refreshNativeNotificationState() {
  if (!androidNotifications.isNativeAndroid) {
    return applyNotificationState('unsupported');
  }

  try {
    const permissionState = await androidNotifications.checkPermissions();
    return applyNotificationState(mapPermissionState(permissionState.notifications));
  } catch (error) {
    console.error('Failed to refresh Android notification permission state', error);
    return applyNotificationState('unsupported');
  }
}

async function requestNativeNotificationPermission() {
  if (!androidNotifications.isNativeAndroid) {
    return applyNotificationState('unsupported');
  }

  useNotificationSoundStore.setState({ isRequestingBrowserNotifications: true });

  try {
    const permissionState = await androidNotifications.requestPermissions();
    return applyNotificationState(mapPermissionState(permissionState.notifications));
  } catch (error) {
    console.error('Failed to request Android notification permission', error);
    return applyNotificationState('unsupported');
  } finally {
    useNotificationSoundStore.setState({ isRequestingBrowserNotifications: false });
  }
}

async function presentNativeNotification(title: string, message: string, withSound: boolean) {
  if (!androidNotifications.isNativeAndroid) {
    return false;
  }

  try {
    const result = await androidNotifications.notify({
      title,
      message,
      withSound,
    });

    return result.presented;
  } catch (error) {
    console.error('Failed to present Android notification', error);
    return false;
  }
}

export const useNotificationSoundStore = create<NotificationSoundState>((set, get) => ({
  soundEnabled: readSoundEnabledPreference(),
  soundCapability: deriveSoundCapability(readSoundEnabledPreference(), 'default'),
  browserNotificationState: androidNotifications.isNativeAndroid ? 'default' : 'unsupported',
  soundPromptDismissed: false,
  isEnablingSound: false,
  isRequestingBrowserNotifications: false,

  init: () => {
    const soundEnabled = readSoundEnabledPreference();
    set((state) => ({
      soundEnabled,
      soundCapability: deriveSoundCapability(soundEnabled, state.browserNotificationState),
    }));

    void refreshNativeNotificationState();
  },

  setSoundEnabled: (enabled) => {
    persistSoundEnabledPreference(enabled);
    set((state) => ({
      soundEnabled: enabled,
      soundPromptDismissed: enabled ? false : state.soundPromptDismissed,
      soundCapability: deriveSoundCapability(enabled, state.browserNotificationState),
    }));
  },

  enableSoundFromUserGesture: async () => {
    if (!get().soundEnabled) {
      return false;
    }

    set({ isEnablingSound: true });

    try {
      let notificationState = await refreshNativeNotificationState();
      if (notificationState !== 'granted') {
        notificationState = await requestNativeNotificationPermission();
      }

      if (notificationState !== 'granted') {
        set({
          isEnablingSound: false,
          soundCapability: deriveSoundCapability(get().soundEnabled, notificationState),
        });
        return false;
      }

      const presented = await presentNativeNotification(
        'Notifications enabled',
        'Android notifications will now alert you for new messages.',
        true,
      );

      set({
        isEnablingSound: false,
        soundCapability: presented ? 'enabled' : 'error',
        soundPromptDismissed: false,
      });

      return presented;
    } catch (error) {
      console.error('Failed to enable Android notification sound', error);
      set({
        isEnablingSound: false,
        soundCapability: 'error',
      });
      return false;
    }
  },

  resumeSoundFromRememberedGesture: async () => {
    const notificationState = await refreshNativeNotificationState();
    return get().soundEnabled && notificationState === 'granted';
  },

  playIncomingMessageCue: async () => {
    const notificationState = await refreshNativeNotificationState();
    return get().soundEnabled && notificationState === 'granted';
  },

  requestBrowserNotifications: async () => requestNativeNotificationPermission(),

  dismissSoundPrompt: () => set({ soundPromptDismissed: true }),
  resetSoundPrompt: () => set({ soundPromptDismissed: false }),
  syncBrowserNotificationState: () => {
    void refreshNativeNotificationState();
    return get().browserNotificationState;
  },
}));

export const initNotificationSound = () => {
  useNotificationSoundStore.getState().init();
};

export const sendNotification = (
  title: string,
  message: string,
  options: SendNotificationOptions = {}
) => {
  void (async () => {
    const notificationState = await refreshNativeNotificationState();
    const withSound =
      options.withSound ?? useNotificationSoundStore.getState().soundEnabled;

    if (notificationState === 'granted') {
      const presented = await presentNativeNotification(title, message, withSound);
      if (presented) {
        return;
      }
    }

    toast(title, {
      description: message,
      duration: 4000,
      position: 'top-right',
    });
  })();
};
