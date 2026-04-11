import { useMemo } from 'react';

export function usePwaInstallPrompt() {
  return useMemo(
    () => ({
      canInstall: false,
      isInstalled: false,
      isInstalling: false,
      install: async () => false,
    }),
    [],
  );
}
