import { useNotificationSoundStore } from '@/utils/notificationSound';
import type { CallPhase } from './callStore';

type BrowserAudioContextConstructor = typeof AudioContext;
type CallLoopTone = 'incoming' | 'outgoing' | null;
type CallStatusCue = 'connected' | 'ended';
type OscillatorTypeName = OscillatorType;

interface ToneSegment {
  startMs: number;
  durationMs: number;
  frequencies: number[];
  gain: number;
  oscillatorType?: OscillatorTypeName;
}

interface TonePattern {
  cycleMs: number;
  segments: ToneSegment[];
}

interface ScheduledTone {
  cleanup: () => void;
  timeoutId: number;
}

const CALL_SOUND_CONSENT_STORAGE_KEY = 'callSoundConsentGranted';
const DEFAULT_OSCILLATOR_TYPE: OscillatorTypeName = 'sine';
const ATTACK_SECONDS = 0.016;
const RELEASE_SECONDS = 0.035;
const INCOMING_VIBRATION_PATTERN = [280, 120, 280, 1700];

let audioContext: AudioContext | null = null;
let desiredLoopTone: CallLoopTone = null;
let activeLoopTone: CallLoopTone = null;
let loopTimeoutId: number | null = null;
let scheduledTones = new Set<ScheduledTone>();
let isGestureRearmListenerInstalled = false;
let rearmHandler: (() => void) | null = null;

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

const readCallSoundConsent = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CALL_SOUND_CONSENT_STORAGE_KEY) === 'true';
};

const persistCallSoundConsent = (enabled: boolean) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CALL_SOUND_CONSENT_STORAGE_KEY, String(enabled));
};

const isCallSoundEnabled = () => useNotificationSoundStore.getState().soundEnabled;

const clearVibration = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(0);
};

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

const stopScheduledTones = () => {
  scheduledTones.forEach((tone) => tone.cleanup());
  scheduledTones.clear();
};

const stopLoopPlayback = () => {
  if (loopTimeoutId !== null) {
    window.clearTimeout(loopTimeoutId);
    loopTimeoutId = null;
  }

  activeLoopTone = null;
  stopScheduledTones();
  clearVibration();
};

const scheduleToneSegment = (context: AudioContext, segment: ToneSegment) => {
  const startTime = context.currentTime + segment.startMs / 1000;
  const durationSeconds = segment.durationMs / 1000;
  const attackEndTime = startTime + Math.min(ATTACK_SECONDS, durationSeconds / 3);
  const releaseStartTime = Math.max(
    attackEndTime,
    startTime + durationSeconds - RELEASE_SECONDS
  );
  const gainNode = context.createGain();
  const oscillators = segment.frequencies.map((frequency) => {
    const oscillator = context.createOscillator();
    oscillator.type = segment.oscillatorType ?? DEFAULT_OSCILLATOR_TYPE;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.connect(gainNode);
    oscillator.start(startTime);
    oscillator.stop(startTime + durationSeconds + 0.02);
    return oscillator;
  });

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(segment.gain, attackEndTime);
  gainNode.gain.setValueAtTime(segment.gain, releaseStartTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSeconds);
  gainNode.connect(context.destination);

  const cleanup = () => {
    oscillators.forEach((oscillator) => {
      oscillator.onended = null;
      try {
        oscillator.disconnect();
      } catch {
        // Nodes may already be disconnected during teardown.
      }
    });

    try {
      gainNode.disconnect();
    } catch {
      // Gain node may already be disconnected during teardown.
    }

    if (scheduledTone.timeoutId) {
      window.clearTimeout(scheduledTone.timeoutId);
    }
    scheduledTones.delete(scheduledTone);
  };

  const scheduledTone: ScheduledTone = {
    cleanup,
    timeoutId: window.setTimeout(
      cleanup,
      segment.startMs + segment.durationMs + 160
    ),
  };

  scheduledTones.add(scheduledTone);
  return scheduledTone;
};

const getTonePattern = (tone: Exclude<CallLoopTone, null> | CallStatusCue): TonePattern => {
  switch (tone) {
    case 'incoming':
      return {
        cycleMs: 3600,
        segments: [
          { startMs: 0, durationMs: 380, frequencies: [440, 480], gain: 0.02 },
          { startMs: 620, durationMs: 380, frequencies: [440, 480], gain: 0.02 },
        ],
      };
    case 'outgoing':
      return {
        cycleMs: 6000,
        segments: [
          { startMs: 0, durationMs: 1900, frequencies: [440, 480], gain: 0.016 },
        ],
      };
    case 'connected':
      return {
        cycleMs: 420,
        segments: [
          { startMs: 0, durationMs: 110, frequencies: [523.25], gain: 0.018, oscillatorType: 'triangle' },
          { startMs: 160, durationMs: 140, frequencies: [659.25], gain: 0.018, oscillatorType: 'triangle' },
        ],
      };
    case 'ended':
      return {
        cycleMs: 460,
        segments: [
          { startMs: 0, durationMs: 130, frequencies: [659.25], gain: 0.018, oscillatorType: 'triangle' },
          { startMs: 170, durationMs: 170, frequencies: [392], gain: 0.016, oscillatorType: 'triangle' },
        ],
      };
  }
};

const installGestureRearmListeners = () => {
  if (
    typeof document === 'undefined' ||
    isGestureRearmListenerInstalled ||
    !isCallSoundEnabled() ||
    !readCallSoundConsent()
  ) {
    return;
  }

  rearmHandler = () => {
    removeGestureRearmListeners();
    void primeCallSoundFromUserGesture();
  };

  ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, rearmHandler!, { once: true });
  });

  isGestureRearmListenerInstalled = true;
};

const ensureAudioContextReady = async () => {
  if (!isCallSoundEnabled()) {
    return null;
  }

  const context = createAudioContext();
  if (!context) {
    return null;
  }

  if (context.state === 'running') {
    return context;
  }

  try {
    await context.resume();
    return context;
  } catch (error) {
    if (readCallSoundConsent()) {
      installGestureRearmListeners();
    }

    console.warn('Call sound playback is waiting on a user gesture.', error);
    return null;
  }
};

const schedulePatternPlayback = (
  context: AudioContext,
  pattern: TonePattern,
  options: { vibrate?: boolean } = {}
) => {
  pattern.segments.forEach((segment) => {
    scheduleToneSegment(context, segment);
  });

  if (
    options.vibrate &&
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
    navigator.vibrate(INCOMING_VIBRATION_PATTERN);
  }
};

const runLoopCycle = async (tone: Exclude<CallLoopTone, null>) => {
  if (!isCallSoundEnabled() || desiredLoopTone !== tone) {
    stopLoopPlayback();
    return;
  }

  const context = await ensureAudioContextReady();
  if (!context || desiredLoopTone !== tone) {
    return;
  }

  activeLoopTone = tone;
  const pattern = getTonePattern(tone);
  schedulePatternPlayback(context, pattern, {
    vibrate: tone === 'incoming',
  });

  loopTimeoutId = window.setTimeout(() => {
    void runLoopCycle(tone);
  }, pattern.cycleMs);
};

export const initCallSounds = () => {
  installGestureRearmListeners();
};

export const primeCallSoundFromUserGesture = async () => {
  if (!isCallSoundEnabled()) {
    return false;
  }

  const context = createAudioContext();
  if (!context) {
    return false;
  }

  try {
    await context.resume();
    persistCallSoundConsent(true);
    removeGestureRearmListeners();

    if (desiredLoopTone && (activeLoopTone !== desiredLoopTone || loopTimeoutId === null)) {
      stopLoopPlayback();
      void runLoopCycle(desiredLoopTone);
    }

    return true;
  } catch (error) {
    installGestureRearmListeners();
    console.warn('Failed to prime call sound playback from a user gesture.', error);
    return false;
  }
};

export const syncCallToneLoop = (phase: CallPhase) => {
  const nextTone: CallLoopTone =
    phase === 'incoming-ringing'
      ? 'incoming'
      : phase === 'outgoing-ringing'
        ? 'outgoing'
        : null;

  desiredLoopTone = nextTone;

  if (!nextTone || !isCallSoundEnabled()) {
    stopLoopPlayback();
    if (isCallSoundEnabled()) {
      installGestureRearmListeners();
    }
    return;
  }

  if (activeLoopTone === nextTone && loopTimeoutId !== null) {
    return;
  }

  stopLoopPlayback();
  void runLoopCycle(nextTone);
};

export const playCallStatusCue = async (cue: CallStatusCue) => {
  if (!isCallSoundEnabled()) {
    return false;
  }

  const context = await ensureAudioContextReady();
  if (!context) {
    return false;
  }

  schedulePatternPlayback(context, getTonePattern(cue));
  return true;
};

export const stopCallSounds = () => {
  desiredLoopTone = null;
  stopLoopPlayback();
};
