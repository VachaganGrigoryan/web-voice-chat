import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAndroidCallRingtonePlugin {
  playDefaultRingtone(): Promise<void>;
  stop(): Promise<void>;
}

const nativePlugin = registerPlugin<NativeAndroidCallRingtonePlugin>(
  'AndroidCallRingtone',
);

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const androidCallRingtone = {
  isNativeAndroid,
  async playDefaultRingtone() {
    if (!isNativeAndroid) {
      return false;
    }

    await nativePlugin.playDefaultRingtone();
    return true;
  },
  async stop() {
    if (!isNativeAndroid) {
      return;
    }

    await nativePlugin.stop();
  },
};
