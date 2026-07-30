import type {
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  PostingPolicy,
} from '@/api/types';
import type { ContainerCapabilities, ContainerSource } from './types';

/**
 * The only module where the two container policy vocabularies meet.
 *
 * Conversations say `everyone | admins`. Channels say
 * `owner | moderators | members | everyone`. The trap is that **"everyone" is
 * not the same word in the two**: a conversation's `everyone` means every
 * *member of that conversation*, while a channel's `everyone` means the
 * *public*. Comparing the strings, or mapping both to a shared "everyone"
 * constant, grants non-members posting rights in group chats.
 *
 * Both are projected onto one ordered standing scale instead. A viewer may act
 * when their standing is at least as strong as the policy's threshold, i.e.
 * when `viewerRank <= policyRank`.
 *
 * Everything here is a *fallback*, used before the server's capabilities
 * arrive and when a cached entry is stale. The server's answer always wins;
 * `ContainerCapabilities.source` records which one produced the current values.
 */

/** Lower is stronger. */
export const STANDING = {
  owner: 0,
  moderator: 1,
  member: 2,
  follower: 3,
  public: 4,
} as const;

export type StandingRank = (typeof STANDING)[keyof typeof STANDING];

/** Threshold meaning "nobody" — no viewer rank satisfies it. */
export const NOBODY = -1;

export type PolicyThreshold = StandingRank | typeof NOBODY;

export interface ViewerStanding {
  readonly isOwner: boolean;
  readonly isModerator: boolean;
  readonly isActiveMember: boolean;
  readonly isFollower: boolean;
}

export const viewerStandingRank = (viewer: ViewerStanding): StandingRank => {
  if (viewer.isOwner) return STANDING.owner;
  if (viewer.isModerator) return STANDING.moderator;
  if (viewer.isActiveMember) return STANDING.member;
  if (viewer.isFollower) return STANDING.follower;
  return STANDING.public;
};

const CONVERSATION_POSTING: Record<PostingPolicy, StandingRank> = {
  // Admin-only posting is the moderator tier; the conversation vocabulary has
  // no separate moderator word.
  admins: STANDING.moderator,
  // Deliberately `member`, not `public`. A group conversation's "everyone"
  // has never meant strangers.
  everyone: STANDING.member,
};

const CHANNEL_POSTING: Record<ChannelPostingPolicy, StandingRank> = {
  owner: STANDING.owner,
  moderators: STANDING.moderator,
  members: STANDING.member,
  // Here "everyone" really does mean the public.
  everyone: STANDING.public,
};

const CHANNEL_COMMENT: Record<ChannelCommentPolicy, PolicyThreshold> = {
  disabled: NOBODY,
  members: STANDING.member,
  followers: STANDING.follower,
  everyone: STANDING.public,
};

export const postingPolicyRank = (source: ContainerSource): PolicyThreshold =>
  source.kind === 'conversation'
    ? CONVERSATION_POSTING[source.conversation.posting_policy]
    : CHANNEL_POSTING[source.channel.posting_policy];

export const commentPolicyRank = (source: ContainerSource): PolicyThreshold =>
  source.kind === 'conversation'
    ? // Conversations have no separate comment policy: if you may post, you may
      // reply in a thread.
      postingPolicyRank(source)
    : CHANNEL_COMMENT[source.channel.comment_policy];

export const satisfies = (
  viewerRank: StandingRank,
  threshold: PolicyThreshold
): boolean => threshold !== NOBODY && viewerRank <= threshold;

export type PolicyDerivedCapabilities = Pick<
  ContainerCapabilities,
  'canPost' | 'canComment' | 'canReplyInline' | 'canStartThread'
>;

/**
 * The provisional answer, used only until the server responds. Callers must
 * mark the result `source: 'policy-fallback'` so the distinction stays visible
 * in code rather than becoming folklore.
 */
export const derivePolicyCapabilities = (
  source: ContainerSource,
  viewer: ViewerStanding
): PolicyDerivedCapabilities => {
  const rank = viewerStandingRank(viewer);
  const canPost = satisfies(rank, postingPolicyRank(source));
  const canComment = satisfies(rank, commentPolicyRank(source));

  return {
    canPost,
    canComment,
    // An inline quote is a message in its own right, so it follows posting.
    canReplyInline: canPost,
    // Opening a thread is the first comment on something, so it follows
    // commenting — a channel with comments disabled has no threads even when
    // its owner may post.
    canStartThread: canComment,
  };
};
