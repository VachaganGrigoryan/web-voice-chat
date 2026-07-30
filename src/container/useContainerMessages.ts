import { useInfiniteQuery } from '@tanstack/react-query';
import { getApiErrorStatus } from '@/api/errors';
import type { MessageDoc, PaginatedResponse } from '@/api/types';
import type { ContainerDescriptor } from './types';

/** A container's message history, paginated by cursor. */

const PAGE_SIZE = 20;

const emptyPage = (): PaginatedResponse<MessageDoc> => ({
  success: true,
  data: [],
  meta: { next_cursor: null, limit: PAGE_SIZE, total: 0 },
});

export function useContainerMessages(descriptor: ContainerDescriptor | null) {
  const query = useInfiniteQuery({
    queryKey: descriptor?.endpoints.queryKey ?? ['messages', 'none'],
    queryFn: ({ pageParam }) =>
      descriptor
        ? descriptor.endpoints.history({
            limit: PAGE_SIZE,
            cursor: pageParam as string | undefined,
          })
        : Promise.resolve(emptyPage()),
    getNextPageParam: (lastPage) => lastPage.meta?.next_cursor ?? undefined,
    initialPageParam: undefined,
    enabled: !!descriptor,
    // A 404 means the container is gone; retrying cannot help and the caller
    // needs to render an access state instead.
    retry: (_count, error) => getApiErrorStatus(error) !== 404,
  });

  return {
    ...query,
    /** True when the container itself no longer resolves. */
    isMissing: query.isError && getApiErrorStatus(query.error) === 404,
  };
}
