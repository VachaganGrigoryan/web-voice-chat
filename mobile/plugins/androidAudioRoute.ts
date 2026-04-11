import { Capacitor, registerPlugin } from '@capacitor/core';

export type AndroidAudioRouteId =
  | 'earpiece'
  | 'speaker'
  | 'headset'
  | 'bluetooth';

export interface AndroidAudioRouteOption {
  id: AndroidAudioRouteId;
  label: string;
  available: boolean;
}

interface NativeAndroidAudioRoutePlugin {
  listRoutes(): Promise<{ routes: AndroidAudioRouteOption[] }>;
  getCurrentRoute(): Promise<{ id: AndroidAudioRouteId }>;
  setRoute(options: { id: AndroidAudioRouteId }): Promise<void>;
  enterCommunicationMode(): Promise<void>;
  exitCommunicationMode(): Promise<void>;
}

const nativePlugin = registerPlugin<NativeAndroidAudioRoutePlugin>('AndroidAudioRoute');

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const androidAudioRoute = {
  isNativeAndroid,
  async listRoutes(): Promise<AndroidAudioRouteOption[]> {
    if (!isNativeAndroid) {
      return [];
    }

    const result = await nativePlugin.listRoutes();
    return result.routes;
  },
  async getCurrentRoute(): Promise<{ id: AndroidAudioRouteId }> {
    if (!isNativeAndroid) {
      return { id: 'speaker' };
    }

    return nativePlugin.getCurrentRoute();
  },
  async setRoute(options: { id: AndroidAudioRouteId }) {
    if (!isNativeAndroid) {
      return;
    }

    await nativePlugin.setRoute(options);
  },
  async enterCommunicationMode() {
    if (!isNativeAndroid) {
      return;
    }

    await nativePlugin.enterCommunicationMode();
  },
  async exitCommunicationMode() {
    if (!isNativeAndroid) {
      return;
    }

    await nativePlugin.exitCommunicationMode();
  },
};
