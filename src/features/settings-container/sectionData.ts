import type { NotificationLevel, Role } from '@/api/types';
import type { ManageDangerAction } from '@/features/manage/sections/DangerSection';
import type { ManageJoinRequestRow } from '@/features/manage/sections/RequestsSection';
import type { ManageMemberRow } from '@/features/manage/sections/MembersSection';
import type { ManageInviteLink } from '@/features/manage/sections/InvitesSection';
import type { RuleOption } from './primitives';

/**
 * What the sections render, normalized away from the resource-specific
 * endpoints behind it.
 *
 * Sections are dumb and take this; the adapters that build it — one for a
 * container, one for a space — are the only place that knows which API a given
 * subject speaks. That is what lets one component serve both shells and all
 * four subject kinds without a resource branch inside a section.
 *
 * A part is `null` when the subject has no endpoint for it. The registry
 * already keeps such a section off the nav, so a `null` here is a belt-and-
 * braces guard rather than a state a user can reach.
 */

export interface OverviewFact {
  readonly label: string;
  readonly value: string;
}

export interface OverviewData {
  /** Absent when the viewer may not rename the subject. */
  readonly edit: {
    readonly name: string;
    readonly description: string | null;
    readonly onSave: (updates: { name: string; description: string | null }) => void;
    readonly isSaving: boolean;
    readonly supportsDescription: boolean;
  } | null;
  readonly facts: readonly OverviewFact[];
}

/** One editable rule. The generic is erased so a list can hold mixed rules. */
export interface AccessRule {
  readonly id: string;
  readonly question: string;
  readonly value: string;
  readonly options: readonly RuleOption<string>[];
  readonly onChange: (value: string) => void;
}

export interface AccessData {
  readonly rules: readonly AccessRule[];
  readonly isSaving: boolean;
}

export interface MembersData {
  readonly members: readonly ManageMemberRow[];
  readonly isLoading: boolean;
  readonly roleOptions: readonly { readonly id: string; readonly label: string }[] | null;
  readonly roleValueFor: ((member: ManageMemberRow) => string) | null;
  readonly onChangeRole: ((member: ManageMemberRow, value: string) => void) | null;
  readonly isUpdatingRole: boolean;
  /** Absent where no removal endpoint exists, e.g. a channel or a space. */
  readonly onRemove: ((member: ManageMemberRow) => void) | null;
  readonly isRemoving: boolean;
}

export interface RolesData {
  readonly roles: readonly Role[];
  readonly isLoading: boolean;
  readonly onCreate: (name: string) => void;
  readonly isCreating: boolean;
  readonly onDelete: (roleId: string) => void;
  readonly isDeleting: boolean;
  readonly onSetPermissions: (role: Role, permissions: readonly string[]) => void;
  readonly savingRoleIds: ReadonlySet<string>;
}

export interface InvitesData {
  readonly onInviteUser: (userId: string) => void;
  readonly isInvitingUser: boolean;
  readonly links: {
    readonly links: readonly ManageInviteLink[];
    readonly isLoading: boolean;
    readonly onCreate: () => void;
    readonly isCreating: boolean;
    readonly onRevoke: (inviteId: string) => void;
    readonly isRevoking: boolean;
  } | null;
}

export interface RequestsData {
  readonly requests: readonly ManageJoinRequestRow[];
  readonly isLoading: boolean;
  readonly onApprove: (requestId: string) => void;
  readonly onReject: (requestId: string) => void;
  readonly isMutating: boolean;
}

export interface NotificationsData {
  readonly level: NotificationLevel;
  readonly onLevelChange: (level: NotificationLevel) => void;
  readonly mutedUntil: string | null;
  readonly onMutedUntilChange: (mutedUntil: string | null) => void;
  readonly pinned: boolean;
  readonly onPinnedChange: (pinned: boolean) => void;
  readonly archived: boolean;
  readonly onArchivedChange: (archived: boolean) => void;
  /** Both container kinds accept a folder; `null` means the default inbox. */
  readonly folder: string | null;
  readonly folderOptions: readonly string[];
  readonly onFolderChange: (folder: string | null) => void;
  readonly isSaving: boolean;
}

export interface SettingsSectionData {
  readonly overview: OverviewData;
  readonly notifications: NotificationsData | null;
  readonly access: AccessData | null;
  readonly members: MembersData | null;
  readonly roles: RolesData | null;
  readonly invites: InvitesData | null;
  readonly requests: RequestsData | null;
  readonly danger: readonly ManageDangerAction[];
}
