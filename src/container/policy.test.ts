import { describe, expect, it } from 'vitest';
import type {
  Channel,
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  Conversation,
  PostingPolicy,
} from '@/api/types';
import {
  STANDING,
  derivePolicyCapabilities,
  viewerStandingRank,
  type ViewerStanding,
} from './policy';
import type { ContainerSource } from './types';

const conversationSource = (posting: PostingPolicy): ContainerSource => ({
  kind: 'conversation',
  conversation: { posting_policy: posting } as Conversation,
});

const channelSource = (
  posting: ChannelPostingPolicy,
  comment: ChannelCommentPolicy = 'everyone'
): ContainerSource => ({
  kind: 'channel',
  channel: { posting_policy: posting, comment_policy: comment } as Channel,
  state: null,
});

const OWNER: ViewerStanding = {
  isOwner: true,
  isModerator: true,
  isActiveMember: true,
  isFollower: false,
};
const MODERATOR: ViewerStanding = {
  isOwner: false,
  isModerator: true,
  isActiveMember: true,
  isFollower: false,
};
const MEMBER: ViewerStanding = {
  isOwner: false,
  isModerator: false,
  isActiveMember: true,
  isFollower: false,
};
const FOLLOWER: ViewerStanding = {
  isOwner: false,
  isModerator: false,
  isActiveMember: false,
  isFollower: true,
};
const STRANGER: ViewerStanding = {
  isOwner: false,
  isModerator: false,
  isActiveMember: false,
  isFollower: false,
};

const VIEWERS = [
  ['owner', OWNER],
  ['moderator', MODERATOR],
  ['member', MEMBER],
  ['follower', FOLLOWER],
  ['stranger', STRANGER],
] as const;

describe('viewerStandingRank', () => {
  it('ranks strongest standing first', () => {
    expect(viewerStandingRank(OWNER)).toBe(STANDING.owner);
    expect(viewerStandingRank(MODERATOR)).toBe(STANDING.moderator);
    expect(viewerStandingRank(MEMBER)).toBe(STANDING.member);
    expect(viewerStandingRank(FOLLOWER)).toBe(STANDING.follower);
    expect(viewerStandingRank(STRANGER)).toBe(STANDING.public);
  });
});

describe('conversation posting policy', () => {
  const expected: Record<PostingPolicy, Record<string, boolean>> = {
    admins: {
      owner: true,
      moderator: true,
      member: false,
      follower: false,
      stranger: false,
    },
    everyone: {
      owner: true,
      moderator: true,
      member: true,
      follower: false,
      stranger: false,
    },
  };

  for (const policy of ['admins', 'everyone'] as const) {
    for (const [name, viewer] of VIEWERS) {
      it(`${policy} / ${name} -> ${expected[policy][name]}`, () => {
        const { canPost } = derivePolicyCapabilities(
          conversationSource(policy),
          viewer
        );
        expect(canPost).toBe(expected[policy][name]);
      });
    }
  }

  // The whole reason the ladder exists.
  it('does not let a non-member post in an "everyone" conversation', () => {
    expect(
      derivePolicyCapabilities(conversationSource('everyone'), STRANGER).canPost
    ).toBe(false);
    expect(
      derivePolicyCapabilities(conversationSource('everyone'), FOLLOWER).canPost
    ).toBe(false);
  });
});

describe('channel posting policy', () => {
  const expected: Record<ChannelPostingPolicy, Record<string, boolean>> = {
    owner: {
      owner: true,
      moderator: false,
      member: false,
      follower: false,
      stranger: false,
    },
    moderators: {
      owner: true,
      moderator: true,
      member: false,
      follower: false,
      stranger: false,
    },
    members: {
      owner: true,
      moderator: true,
      member: true,
      follower: false,
      stranger: false,
    },
    everyone: {
      owner: true,
      moderator: true,
      member: true,
      follower: true,
      stranger: true,
    },
  };

  for (const policy of [
    'owner',
    'moderators',
    'members',
    'everyone',
  ] as const) {
    for (const [name, viewer] of VIEWERS) {
      it(`${policy} / ${name} -> ${expected[policy][name]}`, () => {
        const { canPost } = derivePolicyCapabilities(
          channelSource(policy),
          viewer
        );
        expect(canPost).toBe(expected[policy][name]);
      });
    }
  }

  it('does let a stranger post in an "everyone" channel', () => {
    expect(
      derivePolicyCapabilities(channelSource('everyone'), STRANGER).canPost
    ).toBe(true);
  });
});

describe('the two vocabularies disagree about "everyone"', () => {
  it('same word, different audience', () => {
    const inConversation = derivePolicyCapabilities(
      conversationSource('everyone'),
      STRANGER
    ).canPost;
    const inChannel = derivePolicyCapabilities(
      channelSource('everyone'),
      STRANGER
    ).canPost;

    expect(inConversation).toBe(false);
    expect(inChannel).toBe(true);
  });
});

describe('channel comment policy', () => {
  const expected: Record<ChannelCommentPolicy, Record<string, boolean>> = {
    disabled: {
      owner: false,
      moderator: false,
      member: false,
      follower: false,
      stranger: false,
    },
    members: {
      owner: true,
      moderator: true,
      member: true,
      follower: false,
      stranger: false,
    },
    followers: {
      owner: true,
      moderator: true,
      member: true,
      follower: true,
      stranger: false,
    },
    everyone: {
      owner: true,
      moderator: true,
      member: true,
      follower: true,
      stranger: true,
    },
  };

  for (const policy of [
    'disabled',
    'members',
    'followers',
    'everyone',
  ] as const) {
    for (const [name, viewer] of VIEWERS) {
      it(`${policy} / ${name} -> ${expected[policy][name]}`, () => {
        const { canComment } = derivePolicyCapabilities(
          channelSource('everyone', policy),
          viewer
        );
        expect(canComment).toBe(expected[policy][name]);
      });
    }
  }

  it('disables threads when comments are disabled, even for the owner', () => {
    const caps = derivePolicyCapabilities(
      channelSource('owner', 'disabled'),
      OWNER
    );
    expect(caps.canPost).toBe(true);
    expect(caps.canStartThread).toBe(false);
    expect(caps.canComment).toBe(false);
  });
});

describe('conversations have no separate comment policy', () => {
  it('commenting follows posting', () => {
    for (const [, viewer] of VIEWERS) {
      const caps = derivePolicyCapabilities(conversationSource('admins'), viewer);
      expect(caps.canComment).toBe(caps.canPost);
      expect(caps.canStartThread).toBe(caps.canPost);
    }
  });
});
