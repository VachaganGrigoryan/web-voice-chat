import { Capacitor, registerPlugin, type PermissionState } from '@capacitor/core';

export interface AndroidNotificationsPermissions {
  notifications: PermissionState;
}

export interface AndroidNotificationResult {
  presented: boolean;
  reason?: string;
}

interface NativeAndroidNotificationsPlugin {
  checkPermissions(): Promise<AndroidNotificationsPermissions>;
  requestPermissions(): Promise<AndroidNotificationsPermissions>;
  notify(options: {
    title: string;
    message: string;
    withSound?: boolean;
  }): Promise<AndroidNotificationResult>;
}

const nativePlugin = registerPlugin<NativeAndroidNotificationsPlugin>('AndroidNotifications');

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const deniedPermissions: AndroidNotificationsPermissions = {
  notifications: 'denied',
};

export const androidNotifications = {
  isNativeAndroid,
  async checkPermissions(): Promise<AndroidNotificationsPermissions> {
    if (!isNativeAndroid) {
      return deniedPermissions;
    }

    return nativePlugin.checkPermissions();
  },
  async requestPermissions(): Promise<AndroidNotificationsPermissions> {
    if (!isNativeAndroid) {
      return deniedPermissions;
    }

    return nativePlugin.requestPermissions();
  },
  async notify(options: {
    title: string;
    message: string;
    withSound?: boolean;
  }): Promise<AndroidNotificationResult> {
    if (!isNativeAndroid) {
      return {
        presented: false,
        reason: 'not_native_android',
      };
    }

    return nativePlugin.notify(options);
  },
};
