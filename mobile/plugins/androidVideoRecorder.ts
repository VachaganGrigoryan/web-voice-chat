import { Capacitor, registerPlugin, type PermissionState } from '@capacitor/core';

export interface AndroidVideoRecorderPermissions {
  camera: PermissionState;
  microphone: PermissionState;
}

export interface AndroidVideoRecording {
  uri: string;
  mimeType: string;
  durationMs: number;
  sizeBytes: number;
}

interface NativeAndroidVideoRecorderPlugin {
  checkPermissions(): Promise<AndroidVideoRecorderPermissions>;
  requestPermissions(): Promise<AndroidVideoRecorderPermissions>;
  record(options: {
    maxDurationMs: number;
    maxFileSizeBytes: number;
    preferredCamera: 'front' | 'back';
  }): Promise<AndroidVideoRecording>;
}

const nativePlugin = registerPlugin<NativeAndroidVideoRecorderPlugin>('AndroidVideoRecorder');

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const deniedPermissions: AndroidVideoRecorderPermissions = {
  camera: 'denied',
  microphone: 'denied',
};

export const androidVideoRecorder = {
  isNativeAndroid,
  async checkPermissions(): Promise<AndroidVideoRecorderPermissions> {
    if (!isNativeAndroid) {
      return deniedPermissions;
    }

    return nativePlugin.checkPermissions();
  },
  async requestPermissions(): Promise<AndroidVideoRecorderPermissions> {
    if (!isNativeAndroid) {
      return deniedPermissions;
    }

    return nativePlugin.requestPermissions();
  },
  async record(options: {
    maxDurationMs: number;
    maxFileSizeBytes: number;
    preferredCamera: 'front' | 'back';
  }): Promise<AndroidVideoRecording> {
    if (!isNativeAndroid) {
      throw new Error('Native Android video recording is not available on this platform.');
    }

    return nativePlugin.record(options);
  },
};
