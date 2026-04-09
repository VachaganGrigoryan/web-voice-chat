import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.MOBILE_LIVE_RELOAD_URL?.trim();

const config: CapacitorConfig = {
  appId: 'com.blackway.voca',
  appName: 'Vogi',
  webDir: 'dist',
  android: {
    path: 'android',
  },
  ...(liveReloadUrl
    ? {
        server: {
          url: liveReloadUrl,
          cleartext: liveReloadUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
