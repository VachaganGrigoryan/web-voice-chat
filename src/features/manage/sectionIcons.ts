import { Bell, Hash, Info, Radio, ShieldCheck, TriangleAlert, UserPlus, Users } from 'lucide-react';
import type { SettingsSectionId } from '@/features/settings-container/sections/registry';

/** Icons live here rather than in the registry, which stays free of UI imports. */
export const SECTION_ICONS: Record<SettingsSectionId, typeof Hash> = {
  general: Hash,
  notifications: Bell,
  access: Info,
  members: Users,
  roles: ShieldCheck,
  invites: UserPlus,
  requests: Radio,
  danger: TriangleAlert,
};
