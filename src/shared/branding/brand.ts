export const BRAND = {
  name: 'Vogi',
  shortName: 'Vogi',
  description: 'Voice, messages, media, and calls in one platform.',
  colors: {
    primary: '#D90429',
    black: '#0a0a0a',
    white: '#ffffff',
  },
  themeColor: '#0a0a0a',
  backgroundColor: '#0a0a0a',
  assets: {
    symbol: '/brand/logo-symbol.svg',
    symbolMonochrome: '/brand/logo-symbol-monochrome.svg',
    wordmark: '/brand/logo-wordmark.svg',
    wordmarkLight: '/brand/logo-wordmark-light.svg',
    wordmarkDark: '/brand/logo-wordmark-dark.svg',
    favicon: '/brand/favicon.svg',
    faviconPng: '/brand/favicon-32x32.png',
    appleTouchIcon: '/brand/apple-touch-icon.png',
    appIcon192: '/brand/app-icon-192.png',
    appIcon512: '/brand/app-icon-512.png',
    manifest: '/manifest.webmanifest',
  },
} as const;

export type BrandTheme = 'light' | 'dark';

export function getBrandWordmarkSrc(theme: BrandTheme) {
  return theme === 'dark' ? BRAND.assets.wordmarkLight : BRAND.assets.wordmarkDark;
}
