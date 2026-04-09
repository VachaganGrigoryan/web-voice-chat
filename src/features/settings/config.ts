import { FontSizePreference, LayoutDensity } from '@/components/ThemeProvider';
import { SettingsTab } from '@/app/routes';
import { Bell, Info, KeyRound, Palette, Shield, User } from 'lucide-react';

export const SETTINGS_NAV_ITEMS: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof User;
  description: string;
}> = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Identity and public details' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and visual preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Chat sound behavior' },
  { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Discovery and account access' },
  { id: 'passkeys', label: 'Passkeys', icon: KeyRound, description: 'Passwordless sign-in methods' },
  { id: 'discovery', label: 'Discovery', icon: User, description: 'Codes and invite links' },
  { id: 'about', label: 'About', icon: Info, description: 'Branding, version, and install status' },
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
