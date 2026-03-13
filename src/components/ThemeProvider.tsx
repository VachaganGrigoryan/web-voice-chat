import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light' | 'system';
type ThemeColor = 'default' | 'zinc' | 'slate' | 'neutral' | 'stone';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultTheme?: ThemeColor;
  storageKey?: string;
}

interface ThemeProviderState {
  mode: ThemeMode;
  theme: ThemeColor;
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemeColor) => void;
}

const initialState: ThemeProviderState = {
  mode: 'system',
  theme: 'default',
  setMode: () => null,
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultMode = 'system',
  defaultTheme = 'default',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem(`${storageKey}-mode`) as ThemeMode) || defaultMode
  );
  
  const [theme, setTheme] = useState<ThemeColor>(
    () => (localStorage.getItem(`${storageKey}-color`) as ThemeColor) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (mode === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(mode);
  }, [mode]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove all theme classes
    const themeClasses = Array.from(root.classList).filter(cls => cls.startsWith('theme-'));
    root.classList.remove(...themeClasses);
    
    // Add new theme class
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  const value = {
    mode,
    theme,
    setMode: (mode: ThemeMode) => {
      localStorage.setItem(`${storageKey}-mode`, mode);
      setMode(mode);
    },
    setTheme: (theme: ThemeColor) => {
      localStorage.setItem(`${storageKey}-color`, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
