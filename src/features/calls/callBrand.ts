import { BRAND } from '@/shared/branding/brand';

export const CALL_BRAND_PRIMARY = BRAND.colors.primary;
export const CALL_BRAND_BLACK = BRAND.colors.black;

const clampAlpha = (alpha: number) => Math.min(Math.max(alpha, 0), 1);

const hexToRgbChannels = (hex: string) => {
  const normalized = hex.replace('#', '').trim();
  const safeHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized;

  const value = Number.parseInt(safeHex, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const getCallBrandColor = (alpha = 1) => {
  const { r, g, b } = hexToRgbChannels(CALL_BRAND_PRIMARY);
  return `rgba(${r}, ${g}, ${b}, ${clampAlpha(alpha)})`;
};
