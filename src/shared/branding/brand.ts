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
    symbols: {
      sm: '/brand/vogi-symbol-256x256.png',
      md: '/brand/vogi-symbol-256x256.png',
      lg: '/brand/vogi-symbol-256x256.png',
      xl: '/brand/vogi-symbol-256x256.png',
      favicon: '/brand/vogi-symbol-64x64.png',
    },
    appIcon: '/brand/vogi-symbol-512x512.png',
    wordmark: '/brand/vogi-full-1024x256.png',
    compactWordmark: '/brand/vogi-full-512x128.png',
    favicon: '/brand/vogi-symbol-64x64.png',
    appleTouchIcon: '/brand/vogi-symbol-512x512.png',
    appIcon192: '/brand/vogi-symbol-256x256.png',
    appIcon512: '/brand/vogi-symbol-512x512.png',
    manifest: '/manifest.webmanifest',
  },
} as const;

export type BrandTheme = 'light' | 'dark';
export type BrandLogoSize = 'sm' | 'md' | 'lg';

export function getBrandWordmarkSrc(_theme: BrandTheme, size: BrandLogoSize = 'md') {
  return size === 'sm' ? BRAND.assets.compactWordmark : BRAND.assets.wordmark;
}

export function getBrandSymbolSrc(size: BrandLogoSize = 'md') {
  if (size === 'sm') {
    return BRAND.assets.symbols.sm;
  }

  if (size === 'lg') {
    return BRAND.assets.symbols.lg;
  }

  return BRAND.assets.symbols.md;
}
