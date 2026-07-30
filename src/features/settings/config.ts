import { FontSizePreference, LayoutDensity, ThemeColor } from '@/components/ThemeProvider';
import { Bell, Palette, Shield, UserCog, type LucideIcon } from 'lucide-react';

/**
 * Settings covers preferences only. Identity editing lives on the user's own
 * profile and invite codes live under People, because neither is a setting.
 * `SETTINGS_TABS` in app/routes.ts is derived from this list, so the two cannot
 * drift the way the hand-maintained pair used to.
 */
export const SETTINGS_NAV_ITEMS = [
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme, text size and density' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Sound, alerts and quiet hours' },
  { id: 'privacy', label: 'Privacy & Safety', icon: Shield, description: 'Discoverability and blocking' },
  { id: 'account', label: 'Account', icon: UserCog, description: 'Sign-in methods, app version and install' },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}>;

export type SettingsNavItem = (typeof SETTINGS_NAV_ITEMS)[number];

/** Every value ThemeProvider accepts now has matching CSS in index.css. */
export const COLOR_THEME_OPTIONS: ReadonlyArray<{
  value: ThemeColor;
  label: string;
  swatch: string;
}> = [
  { value: 'default', label: 'Default', swatch: 'bg-zinc-900 dark:bg-zinc-100' },
  { value: 'zinc', label: 'Zinc', swatch: 'bg-zinc-700 dark:bg-zinc-300' },
  { value: 'slate', label: 'Slate', swatch: 'bg-slate-900 dark:bg-slate-100' },
  { value: 'neutral', label: 'Neutral', swatch: 'bg-neutral-900 dark:bg-neutral-100' },
  { value: 'stone', label: 'Stone', swatch: 'bg-stone-900 dark:bg-stone-100' },
];

export const FONT_SIZE_OPTIONS: Array<{
  value: FontSizePreference;
  label: string;
  description: string;
}> = [
  { value: 'small', label: 'Small', description: 'Tighter text sizing for dense screens and smaller laptops.' },
  { value: 'medium', label: 'Medium', description: 'Balanced readability and information density for everyday use.' },
  { value: 'large', label: 'Large', description: 'Larger text and looser rhythm for easier reading.' },
];

export const DENSITY_OPTIONS: Array<{
  value: LayoutDensity;
  label: string;
  description: string;
}> = [
  { value: 'wide', label: 'Wide', description: 'More breathing room in panels, lists, headers, and controls.' },
  { value: 'compact', label: 'Compact', description: 'Default density with balanced spacing across the app.' },
  { value: 'very-compact', label: 'Very Compact', description: 'Fits more content on screen for heavy chat workflows.' },
];
