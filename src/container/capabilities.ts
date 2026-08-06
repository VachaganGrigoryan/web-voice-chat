import {
  derivePolicyCapabilities,
  type ViewerStanding,
} from './policy';
import type {
  ContainerCapabilities,
  ContainerSource,
  JoinAffordance,
  ViewerMembership,
} from './types';

/**
 * The only module in the client that knows the backend's dotted permission
 * vocabulary. Everything downstream reads booleans.
 */

export const ACTION = {
  resourceView: 'resource.view',
  resourceManage: 'resource.manage',
  resourceDelete: 'resource.delete',
  memberView: 'member.view',
  memberInvite: 'member.invite',
  memberApprove: 'member.approve',
  memberManage: 'member.manage',
  roleView: 'role.view',
  roleManage: 'role.manage',
  messageRead: 'message.read',
  messageCreate: 'message.create',
  messageEditOwn: 'message.edit.own',
  messageEditAny: 'message.edit.any',
  messageDeleteOwn: 'message.delete.own',
  messageDeleteAny: 'message.delete.any',
  messagePin: 'message.pin',
  threadCreate: 'thread.create',
  threadReply: 'thread.reply',
  reactionCreate: 'reaction.create',
  callCreate: 'call.create',
  pollCreate: 'poll.create',
} as const;

/**
 * What a container header and composer need in order to paint without a
 * follow-up request. `resource.manage` is included because it decides whether
 * the Manage affordance renders at all. Management sections ask for
 * `member.manage`, `role.manage`, `resource.delete` and the `.any` variants
 * themselves — putting those here would make every container open expensive.
 */
export const DEFAULT_ACTIONS: Readonly<Record<'channel' | 'conversation' | 'space', readonly string[]>> = {
  channel: [
    ACTION.resourceView,
    ACTION.messageRead,
    ACTION.messageCreate,
    ACTION.threadCreate,
    ACTION.threadReply,
    ACTION.reactionCreate,
    ACTION.messageEditOwn,
    ACTION.messageDeleteOwn,
    ACTION.pollCreate,
    ACTION.resourceManage,
  ],
  conversation: [
    ACTION.resourceView,
    ACTION.messageRead,
    ACTION.messageCreate,
    ACTION.threadCreate,
    ACTION.threadReply,
    ACTION.reactionCreate,
    ACTION.messageEditOwn,
    ACTION.messageDeleteOwn,
    ACTION.messagePin,
    ACTION.callCreate,
    ACTION.pollCreate,
    ACTION.resourceManage,
  ],
  space: [
    ACTION.resourceView,
    ACTION.resourceManage,
    ACTION.memberView,
    ACTION.memberInvite,
    ACTION.roleView,
  ],
} as const;

/** The server's per-resource capability answer. */
export interface ViewerCapabilitiesView {
  readonly resource: { readonly type: string; readonly id: string };
  readonly allowed: readonly string[];
  readonly denied: readonly string[];
  readonly standing: {
    readonly is_owner: boolean;
    readonly membership_status: string | null;
    readonly is_follower: boolean;
    readonly role_ids: readonly string[];
  };
}

const membershipOf = (
  standing: ViewerCapabilitiesView['standing']
): ViewerMembership => {
  if (standing.is_owner) return 'owner';
  if (standing.membership_status === 'active') return 'member';
  if (standing.membership_status === 'pending') return 'pending';
  if (standing.is_follower) return 'follower';
  return 'guest';
};

const joinAffordanceFor = (
  source: ContainerSource,
  membership: ViewerMembership
): JoinAffordance => {
  if (membership === 'owner' || membership === 'member') return 'none';
  if (membership === 'pending') return 'none';
  if (source.kind === 'conversation') {
    // Conversations are joined by invite or an invite link, never browsed into.
    return 'invite-only';
  }

  switch (source.channel.join_policy) {
    case 'open':
      return membership === 'follower' ? 'join' : 'follow';
    case 'approval':
      return 'request';
    case 'invite_only':
    case 'closed':
      return 'invite-only';
    default:
      return 'none';
  }
};

/**
 * Pin and forward are hard-denied for channels regardless of what the server
 * says: `pinned_message_ids` is a conversation field and forward targets must be
 * conversations, so both return 400 on a channel container. Encoding the known
 * constraint beats rediscovering it as a failed request.
 */
const isChannel = (source: ContainerSource) => source.kind === 'channel';

export const fromPermissionStrings = (
  source: ContainerSource,
  view: ViewerCapabilitiesView
): ContainerCapabilities => {
  const allowed = new Set(view.allowed);
  const can = (action: string) => allowed.has(action);
  const membership = membershipOf(view.standing);

  return {
    canRead: can(ACTION.messageRead) || can(ACTION.resourceView),
    canPost: can(ACTION.messageCreate),
    canComment: can(ACTION.threadReply),
    canReplyInline: can(ACTION.messageCreate),
    canStartThread: can(ACTION.threadCreate),
    canReact: can(ACTION.reactionCreate),
    canUploadMedia: can(ACTION.messageCreate),
    canCreatePoll: can(ACTION.pollCreate),
    canStartCall: can(ACTION.callCreate),
    canEditOwn: can(ACTION.messageEditOwn) || can(ACTION.messageEditAny),
    canEditAny: can(ACTION.messageEditAny),
    canDeleteOwn: can(ACTION.messageDeleteOwn) || can(ACTION.messageDeleteAny),
    canDeleteAny: can(ACTION.messageDeleteAny),
    canPin: isChannel(source) ? false : can(ACTION.messagePin),
    canForward: isChannel(source) ? false : can(ACTION.messageRead),
    canManage: can(ACTION.resourceManage),
    canManageMembers: can(ACTION.memberManage),
    canManageRoles: can(ACTION.roleManage),
    canInvite: can(ACTION.memberInvite),
    canApproveJoins: can(ACTION.memberApprove),
    canDeleteContainer: can(ACTION.resourceDelete),
    membership,
    joinAffordance: joinAffordanceFor(source, membership),
    source: 'server',
  };
};

/**
 * The provisional answer used before the server responds. Derived from the
 * container's own policy fields plus whatever standing the client already
 * knows; deliberately conservative about management, which is never inferred.
 */
export const fromPolicy = (
  source: ContainerSource,
  viewer: ViewerStanding
): ContainerCapabilities => {
  const derived = derivePolicyCapabilities(source, viewer);
  const membership: ViewerMembership = viewer.isOwner
    ? 'owner'
    : viewer.isActiveMember
      ? 'member'
      : viewer.isFollower
        ? 'follower'
        : 'guest';

  return {
    canRead: true,
    ...derived,
    canReact: derived.canComment,
    canUploadMedia: derived.canPost,
    canCreatePoll: derived.canPost,
    canStartCall: source.kind === 'conversation' && viewer.isActiveMember,
    canEditOwn: true,
    canEditAny: false,
    canDeleteOwn: true,
    canDeleteAny: false,
    canPin: source.kind === 'conversation' && viewer.isModerator,
    canForward: source.kind === 'conversation',
    // Management is never inferred from policy — an ambient Manage button that
    // 403s is worse than one that appears a moment late.
    canManage: viewer.isOwner,
    canManageMembers: viewer.isOwner,
    canManageRoles: viewer.isOwner,
    canInvite: viewer.isOwner,
    canApproveJoins: viewer.isOwner,
    canDeleteContainer: viewer.isOwner,
    membership,
    joinAffordance: joinAffordanceFor(source, membership),
    source: 'policy-fallback',
  };
};

/** The server's answer replaces the fallback wholesale; the two are never blended. */
export const mergeCapabilities = (
  local: ContainerCapabilities,
  server?: ViewerCapabilitiesView | null,
  source?: ContainerSource
): ContainerCapabilities =>
  server && source ? fromPermissionStrings(source, server) : local;
