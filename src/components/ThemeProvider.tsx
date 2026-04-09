import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';
export type ThemeColor = 'default' | 'zinc' | 'slate' | 'neutral' | 'stone';
export type FontSizePreference = 'small' | 'medium' | 'large';
export type LayoutDensity = 'wide' | 'compact' | 'very-compact';

const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];
const THEME_COLORS: ThemeColor[] = ['default', 'zinc', 'slate', 'neutral', 'stone'];
const FONT_SIZE_PREFERENCES: FontSizePreference[] = ['small', 'medium', 'large'];
const LAYOUT_DENSITIES: LayoutDensity[] = ['wide', 'compact', 'very-compact'];

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultMode?: ThemeMode;
  defaultTheme?: ThemeColor;
  defaultFontSize?: FontSizePreference;
  defaultDensity?: LayoutDensity;
  storageKey?: string;
}

interface ThemeProviderState {
  mode: ThemeMode;
  resolvedMode: 'light' | 'dark';
  theme: ThemeColor;
  fontSize: FontSizePreference;
  density: LayoutDensity;
  setMode: (mode: ThemeMode) => void;
  setTheme: (theme: ThemeColor) => void;
  setFontSize: (fontSize: FontSizePreference) => void;
  setDensity: (density: LayoutDensity) => void;
}

const initialState: ThemeProviderState = {
  mode: 'system',
  resolvedMode: 'light',
  theme: 'default',
  fontSize: 'medium',
  density: 'compact',
  setMode: () => null,
  setTheme: () => null,
  setFontSize: () => null,
  setDensity: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

function getStoredPreference<T extends string>(
  key: string,
  fallback: T,
  allowedValues: readonly T[]
) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const storedValue = window.localStorage.getItem(key) as T | null;
  return storedValue && allowedValues.includes(storedValue) ? storedValue : fallback;
}

export function ThemeProvider({
  children,
  defaultMode = 'system',
  defaultTheme = 'default',
  defaultFontSize = 'medium',
  defaultDensity = 'compact',
  storageKey = 'vite-ui-theme',
  ...props
}: ThemeProviderProps) {
  const [mode, setMode] = useState<ThemeMode>(
    () => getStoredPreference(`${storageKey}-mode`, defaultMode, THEME_MODES)
  );
  const [resolvedMode, setResolvedMode] = useState<'light' | 'dark'>('light');

  const [theme, setTheme] = useState<ThemeColor>(
    () => getStoredPreference(`${storageKey}-color`, defaultTheme, THEME_COLORS)
  );

  const [fontSize, setFontSize] = useState<FontSizePreference>(
    () => getStoredPreference(`${storageKey}-font-size`, defaultFontSize, FONT_SIZE_PREFERENCES)
  );

  const [density, setDensity] = useState<LayoutDensity>(
    () => getStoredPreference(`${storageKey}-density`, defaultDensity, LAYOUT_DENSITIES)
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const applyMode = (nextMode: 'light' | 'dark') => {
      setResolvedMode(nextMode);
      root.classList.remove('light', 'dark');
      root.classList.add(nextMode);
    };

    if (mode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const updateSystemMode = (event?: MediaQueryList | MediaQueryListEvent) => {
        applyMode(event?.matches ? 'dark' : 'light');
      };

      updateSystemMode(mediaQuery);

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', updateSystemMode);
        return () => mediaQuery.removeEventListener('change', updateSystemMode);
      }

      mediaQuery.addListener(updateSystemMode);
      return () => mediaQuery.removeListener(updateSystemMode);
    }

    applyMode(mode);
  }, [mode]);

  useEffect(() => {
    const root = window.document.documentElement;

    const themeClasses = Array.from(root.classList).filter((cls) => cls.startsWith('theme-'));
    root.classList.remove(...themeClasses);
    root.classList.add(`theme-${theme}`);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.uiFontSize = fontSize;
  }, [fontSize]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.uiDensity = density;
  }, [density]);

  const value = {
    mode,
    resolvedMode,
    theme,
    fontSize,
    density,
    setMode: (mode: ThemeMode) => {
      localStorage.setItem(`${storageKey}-mode`, mode);
      setMode(mode);
    },
    setTheme: (theme: ThemeColor) => {
      localStorage.setItem(`${storageKey}-color`, theme);
      setTheme(theme);
    },
    setFontSize: (fontSize: FontSizePreference) => {
      localStorage.setItem(`${storageKey}-font-size`, fontSize);
      setFontSize(fontSize);
    },
    setDensity: (density: LayoutDensity) => {
      localStorage.setItem(`${storageKey}-density`, density);
      setDensity(density);
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
