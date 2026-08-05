import type { ManageCapabilities } from '@/features/manage/useManageCapabilities';

/**
 * One registry, resolved per subject, rather than a section list maintained per
 * resource type. A section names the subject kinds it applies to and the
 * capability it needs; anything it does not name is absent, never disabled.
 *
 * A kind is omitted when the backend has no endpoint for it. That is why
 * `access` excludes groups (no conversation policy update endpoint) and
 * `invites`/`requests` exclude channels (no channel invite-link or
 * join-request routes). These are gaps in the API, not choices in the UI, and
 * they are listed in the change's design notes.
 */

export type SettingsSubjectKind = 'dm' | 'group' | 'channel' | 'space';

/** `general` is kept over a clearer name because the management routes use it. */
export type SettingsSectionId =
  | 'general'
  | 'notifications'
  | 'access'
  | 'members'
  | 'roles'
  | 'invites'
  | 'requests'
  | 'danger';

/** The capability gate, named by the field it reads on `ManageCapabilities`. */
export type SettingsCapabilityKey =
  | 'canManage'
  | 'canManageMembers'
  | 'canManageRoles'
  | 'canInvite'
  | 'canApproveJoins';

export interface SettingsSectionDefinition {
  readonly id: SettingsSectionId;
  readonly label: string;
  readonly description: string;
  readonly kinds: readonly SettingsSubjectKind[];
  /** `null` when the section is personal and needs no management capability. */
  readonly requires: SettingsCapabilityKey | null;
}

export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  {
    id: 'general',
    label: 'Overview',
    description: 'Name, description and the facts about this conversation.',
    kinds: ['dm', 'group', 'channel', 'space'],
    requires: null,
  },
  {
    id: 'notifications',
    label: 'Notifications & inbox',
    description: 'How this reaches you, and where it sits in your inbox.',
    kinds: ['dm', 'group', 'channel'],
    requires: null,
  },
  {
    id: 'access',
    label: 'Access & visibility',
    description: 'Who can find this, join it, post and comment.',
    kinds: ['channel', 'space'],
    requires: 'canManage',
  },
  {
    id: 'members',
    label: 'Members',
    description: 'Who is here and what they can do.',
    kinds: ['group', 'channel', 'space'],
    requires: 'canManageMembers',
  },
  {
    id: 'roles',
    label: 'Roles & permissions',
    description: 'The roles that grant permissions, and what each one grants.',
    kinds: ['group', 'channel', 'space'],
    requires: 'canManageRoles',
  },
  {
    id: 'invites',
    label: 'Invites',
    description: 'Invite people directly or with a link.',
    kinds: ['group', 'space'],
    requires: 'canInvite',
  },
  {
    id: 'requests',
    label: 'Join requests',
    description: 'People waiting to be let in.',
    kinds: ['group', 'space'],
    requires: 'canApproveJoins',
  },
  {
    id: 'danger',
    label: 'Leave & delete',
    description: 'Leaving, clearing history, blocking and deletion.',
    kinds: ['dm', 'group', 'channel', 'space'],
    requires: null,
  },
];

/** What a section needs to decide whether it is visible. */
export type SectionCapabilityView = Pick<ManageCapabilities, SettingsCapabilityKey>;

/**
 * The sections visible for one subject and viewer, in registry order. A section
 * gated on a capability the viewer lacks is left out rather than returned in a
 * disabled state, so the caller cannot render it by mistake.
 */
export const resolveSections = (
  kind: SettingsSubjectKind,
  capabilities: SectionCapabilityView
): readonly SettingsSectionDefinition[] =>
  SETTINGS_SECTIONS.filter((section) => {
    if (!section.kinds.includes(kind)) return false;
    if (section.requires === null) return true;
    return capabilities[section.requires];
  });

/**
 * The section to show given a requested id, falling back to the first visible
 * one so a stale or forbidden deep link lands somewhere real.
 */
export const resolveActiveSection = (
  requested: string | undefined,
  visible: readonly SettingsSectionDefinition[]
): SettingsSectionDefinition | null => {
  if (visible.length === 0) return null;
  return visible.find((section) => section.id === requested) ?? visible[0];
};
