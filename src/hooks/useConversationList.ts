import { useInfiniteQuery } from '@tanstack/react-query';
import { conversationsApi, messagesApi } from '@/api/endpoints';
import { threadMessageQueryKey } from '@/api/queryKeys';
import { toSinglePageResponse } from '@/api/utils';
import type { MessageContainerRef } from '@/api/types';

/**
 * Inbox-shaped queries, lifted out of the old chat god-hook so it could be
 * deleted. These are consumed by the rail badges, the command palette and the
 * chat layout; the inbox module folds them into one normalized source later.
 */

export const useConversations = (spaceId?: string | null) =>
  useInfiniteQuery({
    queryKey: ['conversations', spaceId],
    queryFn: ({ pageParam }) =>
      conversationsApi.getConversations(20, pageParam as string | undefined, {
        space_id: spaceId || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    initialPageParam: undefined,
  });

export const useThreadMessages = (
  container: MessageContainerRef | null,
  rootMessageId: string | null
) =>
  useInfiniteQuery({
    queryKey: threadMessageQueryKey(
      container ?? { container_type: 'conversation', container_id: '' },
      rootMessageId ?? ''
    ),
    queryFn: async () => {
      if (!container || !rootMessageId) return toSinglePageResponse([], 0);
      return toSinglePageResponse(await messagesApi.getThreadMessages(rootMessageId));
    },
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor,
    enabled: !!container && !!rootMessageId,
    initialPageParam: undefined,
  });
