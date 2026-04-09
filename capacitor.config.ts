import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackway.voca',
  appName: 'Vogi',
  webDir: 'dist',
  server: {
    url: 'https://chat.vachagan.dev',
    cleartext: false
  }
};

export default config;
