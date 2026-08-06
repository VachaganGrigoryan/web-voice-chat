import type { ResourceScopeType } from '@/api/types';

/**
 * The client-side mirror of the backend permission vocabulary
 * (`app/modules/authorization/permissions.py`), annotated for display.
 *
 * The backend owns the truth; this adds the labels the matrix needs and the
 * grouping that makes a thirty-entry list readable. `unknownPermissions` keeps
 * a role that carries a permission this build has not heard of from silently
 * losing it on save.
 */

export type PermissionGroupId = 'resource' | 'members' | 'roles' | 'messages' | 'content';

export interface PermissionEntry {
  readonly value: string;
  readonly label: string;
  readonly description: string;
  readonly group: PermissionGroupId;
  /** Granted only over content the holder authored. */
  readonly ownScoped?: boolean;
  /** The `.any` permission that also satisfies this `.own` one. */
  readonly anyEquivalent?: string;
  /** Meaningful only on a space, stripped from other scopes by the backend. */
  readonly spaceOnly?: boolean;
}

export const PERMISSION_GROUPS: readonly {
  readonly id: PermissionGroupId;
  readonly label: string;
}[] = [
  { id: 'resource', label: 'This resource' },
  { id: 'members', label: 'Members' },
  { id: 'roles', label: 'Roles' },
  { id: 'messages', label: 'Messages' },
  { id: 'content', label: 'Content' },
];

export const PERMISSION_CATALOG: readonly PermissionEntry[] = [
  { value: 'resource.view', label: 'View', description: 'See that this exists and open it.', group: 'resource' },
  { value: 'resource.manage', label: 'Manage', description: 'Change settings, and open this settings surface.', group: 'resource' },
  { value: 'resource.delete', label: 'Delete', description: 'Delete this permanently.', group: 'resource' },

  { value: 'member.view', label: 'View members', description: 'See the member list.', group: 'members' },
  { value: 'member.invite', label: 'Invite', description: 'Invite people directly or by link.', group: 'members' },
  { value: 'member.approve', label: 'Approve requests', description: 'Accept or reject people asking to join.', group: 'members' },
  { value: 'member.remove', label: 'Remove members', description: 'Remove someone from this resource.', group: 'members' },
  { value: 'member.manage', label: 'Manage members', description: "Change a member's roles and standing.", group: 'members' },

  { value: 'role.view', label: 'View roles', description: 'See which roles exist and what they grant.', group: 'roles' },
  { value: 'role.manage', label: 'Manage roles', description: 'Create roles and change what they grant.', group: 'roles' },

  { value: 'message.read', label: 'Read messages', description: 'Read the message history.', group: 'messages' },
  { value: 'message.create', label: 'Send messages', description: 'Post new messages.', group: 'messages' },
  { value: 'message.edit.own', label: 'Edit own', description: 'Edit messages they sent.', group: 'messages', ownScoped: true, anyEquivalent: 'message.edit.any' },
  { value: 'message.edit.any', label: 'Edit any', description: "Edit anyone's message.", group: 'messages' },
  { value: 'message.delete.own', label: 'Delete own', description: 'Delete messages they sent.', group: 'messages', ownScoped: true, anyEquivalent: 'message.delete.any' },
  { value: 'message.delete.any', label: 'Delete any', description: "Delete anyone's message.", group: 'messages' },
  { value: 'message.pin', label: 'Pin', description: 'Pin a message for everyone.', group: 'messages' },

  { value: 'thread.create', label: 'Start threads', description: 'Start a thread on a message.', group: 'content' },
  { value: 'thread.reply', label: 'Reply in threads', description: 'Reply inside a thread or comment on a post.', group: 'content' },
  { value: 'reaction.create', label: 'React', description: 'Add a reaction.', group: 'content' },
  { value: 'reaction.delete.own', label: 'Remove own reaction', description: 'Remove a reaction they added.', group: 'content', ownScoped: true, anyEquivalent: 'reaction.delete.any' },
  { value: 'reaction.delete.any', label: 'Remove any reaction', description: "Remove anyone's reaction.", group: 'content' },
  { value: 'poll.create', label: 'Create polls', description: 'Create a poll.', group: 'content' },
  { value: 'poll.manage', label: 'Manage polls', description: 'Close or edit a poll.', group: 'content' },
  { value: 'call.create', label: 'Start calls', description: 'Start an audio or video call.', group: 'content' },
  { value: 'call.manage', label: 'Manage calls', description: 'End a call or manage its participants.', group: 'content' },

  { value: 'channel.create', label: 'Create channels', description: 'Create a channel in this space.', group: 'resource', spaceOnly: true },
  { value: 'channel.manage', label: 'Manage channels', description: "Manage this space's channels.", group: 'resource', spaceOnly: true },
  { value: 'channel.delete', label: 'Delete channels', description: "Delete this space's channels.", group: 'resource', spaceOnly: true },
  { value: 'group.create', label: 'Create groups', description: 'Create a group in this space.', group: 'resource', spaceOnly: true },
  { value: 'group.manage', label: 'Manage groups', description: "Manage this space's groups.", group: 'resource', spaceOnly: true },
];

const BY_VALUE = new Map(PERMISSION_CATALOG.map((entry) => [entry.value, entry]));

export const findPermission = (value: string): PermissionEntry | undefined => BY_VALUE.get(value);

/** The permissions worth showing for a scope; space-only entries are stripped elsewhere. */
export const permissionsForScope = (scope: ResourceScopeType): readonly PermissionEntry[] =>
  scope === 'space'
    ? PERMISSION_CATALOG
    : PERMISSION_CATALOG.filter((entry) => !entry.spaceOnly);

/**
 * Permissions on a role that this build does not recognize. They are preserved
 * verbatim on save rather than dropped, so an older client cannot strip a
 * permission a newer backend introduced.
 */
export const unknownPermissions = (permissions: readonly string[]): readonly string[] =>
  permissions.filter((permission) => !BY_VALUE.has(permission));

/**
 * Whether `permission` is effectively granted by `granted`, accounting for an
 * `.any` permission satisfying its `.own` sibling — the same rule the backend
 * applies through `ANY_EQUIVALENT`.
 */
export const isEffectivelyGranted = (
  granted: readonly string[],
  permission: string
): boolean => {
  if (granted.includes(permission)) return true;
  const entry = BY_VALUE.get(permission);
  return Boolean(entry?.anyEquivalent && granted.includes(entry.anyEquivalent));
};
