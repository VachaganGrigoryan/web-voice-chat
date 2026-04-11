import { useNotificationSoundStore } from '@/utils/notificationSound';
import type { CallPhase } from '@/features/calls/callStore';
import {
  initCallSounds as initSharedCallSounds,
  playCallStatusCue as playSharedCallStatusCue,
  primeCallSoundFromUserGesture as primeSharedCallSoundFromUserGesture,
  stopCallSounds as stopSharedCallSounds,
  syncCallToneLoop as syncSharedCallToneLoop,
} from '@/features/calls/callSounds';
import { androidCallRingtone } from '../plugins/androidCallRingtone';

type CallStatusCue = 'connected' | 'ended';

let nativeIncomingRingtoneActive = false;

const isCallSoundEnabled = () => useNotificationSoundStore.getState().soundEnabled;

const stopNativeIncomingRingtone = async () => {
  if (!androidCallRingtone.isNativeAndroid) {
    nativeIncomingRingtoneActive = false;
    return;
  }

  try {
    await androidCallRingtone.stop();
  } catch (error) {
    console.error('Failed to stop the Android ringtone.', error);
  } finally {
    nativeIncomingRingtoneActive = false;
  }
};

const startNativeIncomingRingtone = async () => {
  if (!androidCallRingtone.isNativeAndroid || !isCallSoundEnabled()) {
    return false;
  }

  try {
    await androidCallRingtone.playDefaultRingtone();
    nativeIncomingRingtoneActive = true;
    return true;
  } catch (error) {
    console.error('Failed to play the Android default ringtone.', error);
    nativeIncomingRingtoneActive = false;
    return false;
  }
};

export const initCallSounds = () => {
  initSharedCallSounds();
};

export const primeCallSoundFromUserGesture = async () =>
  primeSharedCallSoundFromUserGesture();

export const syncCallToneLoop = (phase: CallPhase) => {
  if (!isCallSoundEnabled()) {
    stopSharedCallSounds();
    void stopNativeIncomingRingtone();
    return;
  }

  if (phase === 'incoming-ringing' && androidCallRingtone.isNativeAndroid) {
    syncSharedCallToneLoop('idle');

    if (nativeIncomingRingtoneActive) {
      return;
    }

    void (async () => {
      const started = await startNativeIncomingRingtone();
      if (!started) {
        syncSharedCallToneLoop(phase);
      }
    })();
    return;
  }

  if (nativeIncomingRingtoneActive) {
    void stopNativeIncomingRingtone();
  }

  syncSharedCallToneLoop(phase);
};

export const playCallStatusCue = async (cue: CallStatusCue) => {
  if (nativeIncomingRingtoneActive) {
    await stopNativeIncomingRingtone();
  }

  return playSharedCallStatusCue(cue);
};

export const stopCallSounds = () => {
  stopSharedCallSounds();
  void stopNativeIncomingRingtone();
};
