import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const workspaceRoot = path.resolve(__dirname, '..');
const sharedSrcDir = path.resolve(workspaceRoot, 'src');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, '');

  return {
    root: __dirname,
    envDir: workspaceRoot,
    publicDir: path.resolve(workspaceRoot, 'public'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        {
          find: '@/utils/notificationSound',
          replacement: path.resolve(__dirname, 'overrides/notificationSound.ts'),
        },
        {
          find: '@/hooks/usePwaInstallPrompt',
          replacement: path.resolve(__dirname, 'overrides/usePwaInstallPrompt.ts'),
        },
        {
          find: '@/shared/branding/PwaInstallCard',
          replacement: path.resolve(__dirname, 'overrides/PwaInstallCard.tsx'),
        },
        {
          find: /^\.\/tabs\/NotificationsSettingsTab$/,
          replacement: path.resolve(__dirname, 'overrides/NotificationsSettingsTab.tsx'),
        },
        {
          find: /^\.\.\/\.\.\/media\/recorders\/VideoRecorderModal$/,
          replacement: path.resolve(__dirname, 'overrides/VideoRecorderModal.tsx'),
        },
        {
          find: /^\.\.\/\.\.\/media\/recorders\/useAudioRecorderController$/,
          replacement: path.resolve(__dirname, 'overrides/useAudioRecorderController.ts'),
        },
        {
          find: /^\.\/callController$/,
          replacement: path.resolve(__dirname, 'overrides/callController.ts'),
        },
        {
          find: /^\.\/callSounds$/,
          replacement: path.resolve(__dirname, 'overrides/callSounds.ts'),
        },
        {
          find: /^\.\.\/callController$/,
          replacement: path.resolve(__dirname, 'overrides/callController.ts'),
        },
        {
          find: '@',
          replacement: sharedSrcDir,
        },
      ],
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '1.0.0'),
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
