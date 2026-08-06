import { describe, expect, it } from 'vitest';
import type { Channel, Conversation, MessageDoc, PaginatedResponse } from '@/api/types';
import { fromPolicy } from './capabilities';
import { refOf, resolveContainer } from './resolveContainer';
import type {
  ContainerEndpoints,
  ContainerSource,
  ConversationOnlyAffordances,
} from './types';

const channel = (overrides: Partial<Channel> = {}): ContainerSource => ({
  kind: 'channel',
  channel: {
    id: 'ch_1',
    owner: { type: 'user', id: 'u_1' },
    space_id: 'sp_vogi',
    kind: 'text',
    slug: 'general',
    name: 'General',
    description: null,
    avatar: null,
    banner: null,
    visibility: 'public',
    join_policy: 'open',
    posting_policy: 'everyone',
    comment_policy: 'everyone',
    tags: [],
    follower_count: 4,
    ...overrides,
  } as Channel,
  state: null,
});

const conversation = (overrides: Partial<Conversation> = {}): ContainerSource => ({
  kind: 'conversation',
  conversation: {
    id: 'cv_1',
    type: 'group',
    title: 'Launch team',
    member_count: 6,
    posting_policy: 'everyone',
    visibility: 'private',
    space_id: null,
    image: null,
    owner_type: 'user',
    owner_id: 'u_1',
    ...overrides,
  } as Conversation,
});

const OWNER = {
  isOwner: true,
  isModerator: true,
  isActiveMember: true,
  isFollower: false,
};
const STRANGER = {
  isOwner: false,
  isModerator: false,
  isActiveMember: false,
  isFollower: false,
};

const endpointsFor = (source: ContainerSource): ContainerEndpoints => ({
  ref: refOf(source),
  history: async () => ({}) as PaginatedResponse<MessageDoc>,
  threadHistory: async () => [],
  sendText: async () => ({}) as MessageDoc,
  sendMedia: async () => ({}) as MessageDoc,
  sendContent: async () => ({}) as MessageDoc,
  markRead: async () => undefined,
  queryKey: [],
  threadQueryKey: () => [],
});

const resolve = (
  source: ContainerSource,
  lens: 'timeline' | 'feed',
  viewer = OWNER
) =>
  resolveContainer({
    source,
    capabilities: fromPolicy(source, viewer),
    endpoints: endpointsFor(source),
    lens,
  });

describe('lens invariance', () => {
  it('capabilities are identical under both lenses', () => {
    const source = channel();
    expect(resolve(source, 'timeline').capabilities).toEqual(
      resolve(source, 'feed').capabilities
    );
  });

  it('holds for a stranger too', () => {
    const source = channel({ posting_policy: 'members' });
    expect(resolve(source, 'timeline', STRANGER).capabilities).toEqual(
      resolve(source, 'feed', STRANGER).capabilities
    );
  });

  it('holds for conversations', () => {
    const source = conversation();
    expect(resolve(source, 'timeline').capabilities).toEqual(
      resolve(source, 'feed').capabilities
    );
  });

  it('identity and realtime are lens-invariant as well', () => {
    const source = channel();
    const a = resolve(source, 'timeline');
    const b = resolve(source, 'feed');

    // `routes.thread` is a fresh closure per call, so compare its output
    // rather than its reference.
    const comparable = (d: typeof a) => ({
      ...d.identity,
      routes: { ...d.identity.routes, thread: d.identity.routes.thread('m_1') },
    });

    expect(comparable(a)).toEqual(comparable(b));
    expect(a.realtime.reliability).toBe(b.realtime.reliability);
    expect(a.ref).toEqual(b.ref);
  });
});

describe('presentation follows the lens', () => {
  it('renders a channel as a timeline in the chat lens', () => {
    const { presentation } = resolve(channel(), 'timeline');
    expect(presentation.rootItem).toBe('message-row');
    expect(presentation.composer).toBe('inline-bar');
    expect(presentation.order).toBe('newest-at-bottom');
    expect(presentation.threadDisplay).toBe('side-panel');
  });

  it('renders the same channel as a feed in the social lens', () => {
    const { presentation } = resolve(channel(), 'feed');
    expect(presentation.rootItem).toBe('post-card');
    expect(presentation.replyItem).toBe('comment-row');
    expect(presentation.composer).toBe('post-box');
    expect(presentation.order).toBe('newest-first');
  });

  it('hides the composer when the viewer may not post', () => {
    const source = channel({ posting_policy: 'owner' });
    expect(resolve(source, 'timeline', STRANGER).presentation.composer).toBe('none');
    expect(resolve(source, 'feed', STRANGER).presentation.composer).toBe('none');
  });

  it('never shows receipts or typing for a channel', () => {
    const { presentation } = resolve(channel(), 'timeline');
    expect(presentation.showReadReceipts).toBe(false);
    expect(presentation.showTypingIndicator).toBe(false);
  });

  it('shows receipts and typing for a conversation timeline', () => {
    const { presentation } = resolve(conversation(), 'timeline');
    expect(presentation.showReadReceipts).toBe(true);
    expect(presentation.showTypingIndicator).toBe(true);
  });
});

describe('conversation-only affordances', () => {
  const affordances = {} as ConversationOnlyAffordances;

  it('are dropped for a channel even when passed', () => {
    const source = channel();
    const descriptor = resolveContainer({
      source,
      capabilities: fromPolicy(source, OWNER),
      endpoints: endpointsFor(source),
      conversationOnly: affordances,
    });
    expect(descriptor.conversationOnly).toBeNull();
  });

  it('are kept for a conversation', () => {
    const source = conversation();
    const descriptor = resolveContainer({
      source,
      capabilities: fromPolicy(source, OWNER),
      endpoints: endpointsFor(source),
      conversationOnly: affordances,
    });
    expect(descriptor.conversationOnly).toBe(affordances);
  });
});

describe('forward is hard-denied for channels', () => {
  it('regardless of viewer standing', () => {
    const { capabilities } = resolve(channel(), 'timeline', OWNER);
    expect(capabilities.canForward).toBe(false);
  });

  it('but pinning is not — a channel tracks a pinned set of its own', () => {
    const { capabilities } = resolve(channel(), 'timeline', OWNER);
    expect(capabilities.canPin).toBe(true);
  });
});

describe('realtime predicates', () => {
  const { realtime } = resolve(channel(), 'feed');

  it('matches its own container', () => {
    expect(
      realtime.matchesMessage({ container_type: 'channel', container_id: 'ch_1' })
    ).toBe(true);
  });

  it('rejects another container', () => {
    expect(
      realtime.matchesMessage({ container_type: 'channel', container_id: 'ch_2' })
    ).toBe(false);
  });

  it('rejects the same id in a different container type', () => {
    expect(
      realtime.matchesMessage({
        container_type: 'conversation',
        container_id: 'ch_1',
      })
    ).toBe(false);
  });

  it('never matches typing for a channel', () => {
    expect(
      realtime.matchesTyping({ container_type: 'channel', container_id: 'ch_1' })
    ).toBe(false);
  });

  it('tolerates the legacy conversation_id mirror', () => {
    const conversationRealtime = resolve(conversation(), 'timeline').realtime;
    expect(conversationRealtime.matchesMessage({ conversation_id: 'cv_1' })).toBe(
      true
    );
    expect(conversationRealtime.matchesMessage({ conversation_id: 'cv_9' })).toBe(
      false
    );
  });
});

describe('realtime reliability', () => {
  it('is live for a small channel', () => {
    expect(resolve(channel({ follower_count: 10 }), 'feed').realtime.reliability).toBe(
      'live'
    );
  });

  it('is live for a channel with a large audience too, since it broadcasts to its own room', () => {
    const big = channel({ follower_count: 10_000 });
    expect(resolve(big, 'feed').realtime.reliability).toBe('live');
  });

  it('is always live for a conversation', () => {
    const big = conversation({ member_count: 10_000 });
    expect(resolve(big, 'timeline').realtime.reliability).toBe('live');
  });
});

describe('identity routes', () => {
  it('gives a channel both a chat and a social entry point', () => {
    const { identity } = resolve(channel(), 'feed');
    expect(identity.routes.chat).toBe('/chat/channels/ch_1');
    expect(identity.routes.social).toBe('/channels/ch_1');
  });

  it('gives a conversation no social entry point', () => {
    const { identity } = resolve(conversation(), 'timeline');
    expect(identity.routes.chat).toBe('/chat/cv_1');
    expect(identity.routes.social).toBeNull();
  });

  it('omits the manage route when the viewer may not manage', () => {
    expect(resolve(channel(), 'feed', STRANGER).identity.routes.manage).toBeNull();
    expect(resolve(channel(), 'feed', OWNER).identity.routes.manage).toBe(
      '/channels/ch_1/manage/general'
    );
  });
});
