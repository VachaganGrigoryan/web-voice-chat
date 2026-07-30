import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it } from 'vitest';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';
import type { MessageContainerRef, MessageDoc } from '@/api/types';
import {
  applyReactionUpdate,
  clearConversationMessages,
  containerIdOf,
  integrateCreatedMessage,
  prependMessage,
  removeConversationRow,
  resetContainerUnreadCount,
  toggleLocalReactionGroups,
  updateConversationActivity,
  updateMessageEverywhere,
  updateThreadRootSummary,
} from './messageCache';

const CONVERSATION: MessageContainerRef = {
  container_type: 'conversation',
  container_id: 'cv_1',
};
const CHANNEL: MessageContainerRef = { container_type: 'channel', container_id: 'ch_1' };

const message = (overrides: Partial<MessageDoc> = {}): MessageDoc =>
  ({
    id: 'm_1',
    container_type: 'conversation',
    container_id: 'cv_1',
    conversation_id: 'cv_1',
    sender_id: 'u_1',
    type: 'text',
    reply_mode: null,
    reply_to_message_id: null,
    thread_root_id: null,
    is_thread_root: false,
    thread_reply_count: 0,
    last_thread_reply_at: null,
    reactions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as MessageDoc;

const pageOf = (messages: MessageDoc[]) => ({
  pages: [{ data: messages, meta: { next_cursor: null, limit: 20, total: messages.length }, success: true }],
  pageParams: [undefined],
});

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
});

const timeline = (container: MessageContainerRef) =>
  queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
    messageQueryKey(container)
  );

describe('containerIdOf', () => {
  it('prefers container_id', () => {
    expect(containerIdOf({ container_id: 'a', conversation_id: 'b' })).toBe('a');
  });

  it('falls back to the legacy mirror so in-flight events still match', () => {
    expect(containerIdOf({ conversation_id: 'b' })).toBe('b');
  });

  it('is null when neither is present', () => {
    expect(containerIdOf({})).toBeNull();
  });
});

describe('prependMessage', () => {
  it('seeds an empty cache', () => {
    prependMessage(queryClient, CONVERSATION, message());
    expect(timeline(CONVERSATION)?.pages[0].data).toHaveLength(1);
  });

  it('prepends to an existing first page', () => {
    queryClient.setQueryData(messageQueryKey(CONVERSATION), pageOf([message({ id: 'm_old' })]));
    prependMessage(queryClient, CONVERSATION, message({ id: 'm_new' }));
    expect(timeline(CONVERSATION)?.pages[0].data.map((m) => m.id)).toEqual([
      'm_new',
      'm_old',
    ]);
  });

  it('is idempotent for the same id', () => {
    prependMessage(queryClient, CONVERSATION, message());
    prependMessage(queryClient, CONVERSATION, message());
    expect(timeline(CONVERSATION)?.pages[0].data).toHaveLength(1);
  });

  it('survives a malformed page rather than throwing', () => {
    queryClient.setQueryData(messageQueryKey(CONVERSATION), {
      pages: [{ data: null }],
      pageParams: [undefined],
    });
    expect(() => prependMessage(queryClient, CONVERSATION, message())).not.toThrow();
    expect(timeline(CONVERSATION)?.pages[0].data).toHaveLength(1);
  });

  it('keeps containers separate', () => {
    prependMessage(queryClient, CONVERSATION, message());
    expect(timeline(CHANNEL)).toBeUndefined();
  });
});

describe('updateMessageEverywhere', () => {
  it('updates the timeline and the thread cache', () => {
    queryClient.setQueryData(messageQueryKey(CONVERSATION), pageOf([message()]));
    queryClient.setQueryData(
      threadMessageQueryKey(CONVERSATION, 'root_1'),
      pageOf([message()])
    );

    updateMessageEverywhere(queryClient, 'm_1', (m) => ({ ...m, type: 'system' }));

    expect(timeline(CONVERSATION)?.pages[0].data[0].type).toBe('system');
    const thread = queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
      threadMessageQueryKey(CONVERSATION, 'root_1')
    );
    expect(thread?.pages[0].data[0].type).toBe('system');
  });

  it('leaves the cache identical when the id is absent', () => {
    const original = pageOf([message()]);
    queryClient.setQueryData(messageQueryKey(CONVERSATION), original);
    updateMessageEverywhere(queryClient, 'nope', (m) => ({ ...m, type: 'system' }));
    // Same reference: an unrelated event must not churn subscribers.
    expect(timeline(CONVERSATION)).toBe(original);
  });
});

describe('applyReactionUpdate', () => {
  it('replaces the reaction groups', () => {
    queryClient.setQueryData(messageQueryKey(CONVERSATION), pageOf([message()]));
    applyReactionUpdate(queryClient, {
      message_id: 'm_1',
      container_type: 'conversation',
      container_id: 'cv_1',
      conversation_id: 'cv_1',
      reactions: [{ emoji: '👍', user_ids: ['u_2'], count: 1, updated_at: 'now' }],
      updated_at: 'now',
    } as never);
    expect(timeline(CONVERSATION)?.pages[0].data[0].reactions).toHaveLength(1);
  });
});

describe('toggleLocalReactionGroups', () => {
  it('adds a new emoji', () => {
    expect(toggleLocalReactionGroups([], '👍', 'u_1', 'now')).toEqual([
      { emoji: '👍', user_ids: ['u_1'], count: 1, updated_at: 'now' },
    ]);
  });

  it('removes the group when its last user leaves', () => {
    const groups = [{ emoji: '👍', user_ids: ['u_1'], count: 1, updated_at: 'then' }];
    expect(toggleLocalReactionGroups(groups, '👍', 'u_1', 'now')).toEqual([]);
  });

  it('joins an existing group without dropping others', () => {
    const groups = [{ emoji: '👍', user_ids: ['u_2'], count: 1, updated_at: 'then' }];
    const next = toggleLocalReactionGroups(groups, '👍', 'u_1', 'now');
    expect(next[0].user_ids).toEqual(['u_2', 'u_1']);
    expect(next[0].count).toBe(2);
  });

  it('caps distinct emoji at ten, matching the server', () => {
    const groups = Array.from({ length: 10 }, (_, index) => ({
      emoji: `e${index}`,
      user_ids: ['u_2'],
      count: 1,
      updated_at: 'then',
    }));
    expect(toggleLocalReactionGroups(groups, 'new', 'u_1', 'now')).toHaveLength(10);
  });
});

describe('updateThreadRootSummary', () => {
  it('marks the root and bumps its reply count', () => {
    queryClient.setQueryData(
      messageQueryKey(CONVERSATION),
      pageOf([message({ id: 'root_1' })])
    );
    updateThreadRootSummary(queryClient, 'root_1', '2026-02-02T00:00:00Z');
    const root = timeline(CONVERSATION)?.pages[0].data[0];
    expect(root?.is_thread_root).toBe(true);
    expect(root?.thread_reply_count).toBe(1);
    expect(root?.last_thread_reply_at).toBe('2026-02-02T00:00:00Z');
  });
});

describe('integrateCreatedMessage', () => {
  it('puts a channel root on the channel timeline', () => {
    integrateCreatedMessage(
      queryClient,
      CHANNEL,
      message({ container_type: 'channel', container_id: 'ch_1', conversation_id: 'ch_1' })
    );
    expect(timeline(CHANNEL)?.pages[0].data).toHaveLength(1);
  });

  it('puts a channel thread reply in the thread cache, not the timeline', () => {
    integrateCreatedMessage(
      queryClient,
      CHANNEL,
      message({
        id: 'reply_1',
        container_type: 'channel',
        container_id: 'ch_1',
        conversation_id: 'ch_1',
        reply_mode: 'thread',
        thread_root_id: 'post_1',
      })
    );
    expect(timeline(CHANNEL)).toBeUndefined();
    const thread = queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
      threadMessageQueryKey(CHANNEL, 'post_1')
    );
    expect(thread?.pages[0].data[0].id).toBe('reply_1');
  });

  it('puts a conversation root on the conversation timeline', () => {
    integrateCreatedMessage(queryClient, CONVERSATION, message());
    expect(timeline(CONVERSATION)?.pages[0].data).toHaveLength(1);
  });

  it('puts a conversation thread reply in the parent container thread cache', () => {
    integrateCreatedMessage(
      queryClient,
      CONVERSATION,
      message({
        id: 'reply_1',
        reply_mode: 'thread',
        thread_root_id: 'root_1',
      })
    );
    expect(timeline(CONVERSATION)).toBeUndefined();
    const thread = queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
      threadMessageQueryKey(CONVERSATION, 'root_1')
    );
    expect(thread?.pages[0].data[0].id).toBe('reply_1');
  });
});

describe('clearConversationMessages', () => {
  it('empties the timeline', () => {
    queryClient.setQueryData(messageQueryKey(CONVERSATION), pageOf([message()]));
    clearConversationMessages(queryClient, 'cv_1', 'cv_1');
    expect(timeline(CONVERSATION)?.pages[0].data).toEqual([]);
  });

  it('empties only thread caches belonging to that conversation', () => {
    queryClient.setQueryData(
      threadMessageQueryKey(CONVERSATION, 'root_mine'),
      pageOf([message({ container_id: 'cv_1', conversation_id: 'cv_1' })])
    );
    const other: MessageContainerRef = {
      container_type: 'conversation',
      container_id: 'cv_2',
    };
    queryClient.setQueryData(
      threadMessageQueryKey(other, 'root_other'),
      pageOf([message({ id: 'm_2', container_id: 'cv_2', conversation_id: 'cv_2' })])
    );

    clearConversationMessages(queryClient, 'cv_1', 'cv_1');

    const mine = queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
      threadMessageQueryKey(CONVERSATION, 'root_mine')
    );
    const untouched = queryClient.getQueryData<{ pages: Array<{ data: MessageDoc[] }> }>(
      threadMessageQueryKey(other, 'root_other')
    );
    expect(mine?.pages[0].data).toEqual([]);
    expect(untouched?.pages[0].data).toHaveLength(1);
  });
});

describe('conversation row projections', () => {
  const rows = () =>
    queryClient.getQueryData<{ pages: Array<{ data: Array<{ conversation_id?: string }> }> }>([
      'conversations',
    ]);

  beforeEach(() => {
    queryClient.setQueryData(['conversations'], {
      pages: [
        {
          data: [
            { id: 'cv_1', conversation_id: 'cv_1', unread_count: 0, last_message_at: null },
            { id: 'cv_2', conversation_id: 'cv_2', unread_count: 3, last_message_at: null },
          ],
        },
      ],
      pageParams: [undefined],
    });
  });

  it('bumps activity and unread for one row only', () => {
    updateConversationActivity(queryClient, 'cv_1', '2026-03-03T00:00:00Z', 1);
    const [first, second] = rows()?.pages[0].data as Array<Record<string, unknown>>;
    expect(first.unread_count).toBe(1);
    expect(first.last_message_at).toBe('2026-03-03T00:00:00Z');
    expect(second.unread_count).toBe(3);
  });

  it('removes a row by either id form', () => {
    removeConversationRow(queryClient, 'cv_1', 'cv_1');
    expect(rows()?.pages[0].data.map((row) => row.conversation_id)).toEqual(['cv_2']);
  });
});

describe('resetContainerUnreadCount', () => {
  it('clears a conversation row without touching others', () => {
    queryClient.setQueryData(['conversations'], {
      pages: [
        {
          data: [
            { id: 'cv_1', conversation_id: 'cv_1', unread_count: 5 },
            { id: 'cv_2', conversation_id: 'cv_2', unread_count: 3 },
          ],
        },
      ],
      pageParams: [undefined],
    });

    resetContainerUnreadCount(queryClient, CONVERSATION);

    const rows = queryClient.getQueryData<{ pages: Array<{ data: Array<{ conversation_id: string; unread_count: number }> }> }>(
      ['conversations']
    );
    expect(rows?.pages[0].data).toEqual([
      { id: 'cv_1', conversation_id: 'cv_1', unread_count: 0 },
      { id: 'cv_2', conversation_id: 'cv_2', unread_count: 3 },
    ]);
  });

  it('clears a channel row in the channel inbox cache, not the conversation cache', () => {
    queryClient.setQueryData(['channels', 'me'], [
      { channel: { id: 'ch_1' }, unread_count: 7 },
      { channel: { id: 'ch_2' }, unread_count: 2 },
    ]);

    resetContainerUnreadCount(queryClient, CHANNEL);

    const rows = queryClient.getQueryData<Array<{ channel: { id: string }; unread_count: number }>>([
      'channels',
      'me',
    ]);
    expect(rows).toEqual([
      { channel: { id: 'ch_1' }, unread_count: 0 },
      { channel: { id: 'ch_2' }, unread_count: 2 },
    ]);
  });

  it('is a no-op when the cache has not been populated yet', () => {
    expect(() => resetContainerUnreadCount(queryClient, CHANNEL)).not.toThrow();
  });
});
