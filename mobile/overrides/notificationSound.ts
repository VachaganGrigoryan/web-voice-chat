import { create } from 'zustand';
import { toast } from 'sonner';

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

const SOUND_ENABLED_STORAGE_KEY = 'soundEnabled';
const SOUND_CONSENT_STORAGE_KEY = 'notificationSoundConsentGranted';
const NOTIFICATION_SOUND_URL = '/notification.mp3';

type BrowserAudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;
let notificationBufferPromise: Promise<AudioBuffer> | null = null;
let shouldUseSynthFallback = false;
let isGestureRearmListenerInstalled = false;
let rearmHandler: (() => void) | null = null;

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

const readSoundConsentPreference = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(SOUND_CONSENT_STORAGE_KEY) === 'true';
};

const persistSoundConsentPreference = (enabled: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SOUND_CONSENT_STORAGE_KEY, String(enabled));
};

const getAudioContextConstructor = (): BrowserAudioContextConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const browserWindow = window as Window &
    typeof globalThis & {
      webkitAudioContext?: BrowserAudioContextConstructor;
    };

  return browserWindow.AudioContext ?? browserWindow.webkitAudioContext ?? null;
};

const createAudioContext = () => {
  if (audioContext && audioContext.state !== 'closed') {
    return audioContext;
  }

  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    return null;
  }

  audioContext = new AudioContextConstructor();
  return audioContext;
};

const loadNotificationBuffer = async (context: AudioContext) => {
  if (shouldUseSynthFallback) {
    throw new Error('Notification sound asset decode previously failed.');
  }

  if (!notificationBufferPromise) {
    notificationBufferPromise = fetch(NOTIFICATION_SOUND_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load notification sound: ${response.status}`);
        }

        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)));
  }

  try {
    return await notificationBufferPromise;
  } catch (error) {
    notificationBufferPromise = null;
    throw error;
  }
};

const playSynthFallback = (context: AudioContext) => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(880, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.18);

  gainNode.gain.setValueAtTime(0.0001, context.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.24);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.26);
};

const playNotificationCue = async () => {
  const context = createAudioContext();
  if (!context) {
    throw new Error('Web Audio is not supported in this runtime.');
  }

  if (shouldUseSynthFallback) {
    playSynthFallback(context);
    return;
  }

  try {
    const buffer = await loadNotificationBuffer(context);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(0);
  } catch (error) {
    shouldUseSynthFallback = true;
    notificationBufferPromise = null;
    console.warn(
      'Notification sound asset failed to decode, falling back to synthesized cue.',
      error,
    );
    playSynthFallback(context);
  }
};

const getBrowserNotificationState = (): BrowserNotificationState => 'unsupported';

const removeGestureRearmListeners = () => {
  if (typeof document === 'undefined' || !isGestureRearmListenerInstalled || !rearmHandler) {
    return;
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.removeEventListener(eventName, rearmHandler!);
  });

  rearmHandler = null;
  isGestureRearmListenerInstalled = false;
};

const installGestureRearmListeners = () => {
  if (
    typeof document === 'undefined' ||
    isGestureRearmListenerInstalled ||
    !readSoundConsentPreference() ||
    !readSoundEnabledPreference()
  ) {
    return;
  }

  rearmHandler = () => {
    removeGestureRearmListeners();
    void useNotificationSoundStore.getState().resumeSoundFromRememberedGesture();
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, rearmHandler!, { once: true });
  });

  isGestureRearmListenerInstalled = true;
};

export const useNotificationSoundStore = create<NotificationSoundState>((set, get) => ({
  soundEnabled: readSoundEnabledPreference(),
  soundCapability: getAudioContextConstructor() ? 'unknown' : 'unsupported',
  browserNotificationState: getBrowserNotificationState(),
  soundPromptDismissed: false,
  isEnablingSound: false,
  isRequestingBrowserNotifications: false,

  init: () => {
    const hasRememberedConsent = readSoundConsentPreference();
    set({
      soundEnabled: readSoundEnabledPreference(),
      soundCapability: getAudioContextConstructor()
        ? hasRememberedConsent
          ? 'unknown'
          : get().soundCapability
        : 'unsupported',
      browserNotificationState: 'unsupported',
    });

    installGestureRearmListeners();
  },

  setSoundEnabled: (enabled) => {
    persistSoundEnabledPreference(enabled);
    if (enabled) {
      installGestureRearmListeners();
    } else {
      removeGestureRearmListeners();
    }

    set((state) => ({
      soundEnabled: enabled,
      soundPromptDismissed: enabled ? false : state.soundPromptDismissed,
      soundCapability:
        !enabled && state.soundCapability === 'blocked' ? 'unknown' : state.soundCapability,
    }));
  },

  enableSoundFromUserGesture: async () => {
    if (!get().soundEnabled) {
      return false;
    }

    const context = createAudioContext();
    if (!context) {
      set({ soundCapability: 'unsupported' });
      return false;
    }

    set({ isEnablingSound: true });

    try {
      await context.resume();
      await playNotificationCue();
      persistSoundConsentPreference(true);
      removeGestureRearmListeners();
      set({
        soundCapability: 'enabled',
        isEnablingSound: false,
        soundPromptDismissed: false,
      });
      return true;
    } catch (error) {
      console.error('Failed to enable notification sound', error);
      installGestureRearmListeners();
      set({
        soundCapability: error instanceof DOMException ? 'blocked' : 'error',
        isEnablingSound: false,
      });
      return false;
    }
  },

  resumeSoundFromRememberedGesture: async () => {
    if (!get().soundEnabled || !readSoundConsentPreference()) {
      return false;
    }

    const context = createAudioContext();
    if (!context) {
      set({ soundCapability: 'unsupported' });
      return false;
    }

    try {
      await context.resume();
      set({ soundCapability: 'enabled' });
      return true;
    } catch (error) {
      console.error('Failed to resume notification sound after remembered consent', error);
      installGestureRearmListeners();
      set({ soundCapability: 'blocked' });
      return false;
    }
  },

  playIncomingMessageCue: async () => {
    if (!get().soundEnabled) {
      return false;
    }

    const context = createAudioContext();
    if (!context) {
      set({ soundCapability: 'unsupported' });
      return false;
    }

    try {
      if (context.state === 'suspended') {
        if (readSoundConsentPreference()) {
          installGestureRearmListeners();
        }

        set({ soundCapability: 'blocked' });
        return false;
      }

      await playNotificationCue();
      set({ soundCapability: 'enabled' });
      return true;
    } catch (error) {
      console.error('Failed to play notification sound', error);
      set({ soundCapability: 'error' });
      return false;
    }
  },

  requestBrowserNotifications: async () => {
    set({
      browserNotificationState: 'unsupported',
      isRequestingBrowserNotifications: false,
    });
    return 'unsupported';
  },

  dismissSoundPrompt: () => set({ soundPromptDismissed: true }),
  resetSoundPrompt: () => set({ soundPromptDismissed: false }),
  syncBrowserNotificationState: () => {
    set({ browserNotificationState: 'unsupported' });
    return 'unsupported';
  },
}));

export const initNotificationSound = () => {
  useNotificationSoundStore.getState().init();
};

export const sendNotification = (title: string, message: string) => {
  toast(title, {
    description: message,
    duration: 4000,
    position: 'top-right',
  });

  void useNotificationSoundStore.getState().playIncomingMessageCue();
};
