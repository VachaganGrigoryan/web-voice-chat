import { useCallback, useEffect, useMemo, useState } from 'react';

function getStandaloneState() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & {
    standalone?: boolean;
  }).standalone === true;
}

export function usePwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(() => getStandaloneState());
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallEvent(promptEvent);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleModeChange = (query: MediaQueryList | MediaQueryListEvent) => {
      setIsInstalled(query.matches);
    };

    handleModeChange(mediaQuery);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleModeChange);
    } else {
      mediaQuery.addListener(handleModeChange);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);

      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleModeChange);
      } else {
        mediaQuery.removeListener(handleModeChange);
      }
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) {
      return false;
    }

    setIsInstalling(true);
    try {
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setInstallEvent(null);
        return true;
      }

      return false;
    } finally {
      setIsInstalling(false);
    }
  }, [installEvent]);

  return useMemo(
    () => ({
      canInstall: !!installEvent && !isInstalled,
      isInstalled,
      isInstalling,
      install,
    }),
    [install, installEvent, isInstalled, isInstalling],
  );
}
