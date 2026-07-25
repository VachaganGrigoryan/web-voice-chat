import { useInfiniteQuery } from '@tanstack/react-query';
import { feedsApi } from '@/api/endpoints';

const PAGE_SIZE = 30;

/** Posts of a channel served as a feed (enforces the channel's read_policy, not membership). */
export function useChannelFeed(channelId: string) {
  return useInfiniteQuery({
    queryKey: ['channel-feed', channelId],
    queryFn: ({ pageParam }) => feedsApi.getChannelPosts(channelId, PAGE_SIZE, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: Boolean(channelId),
  });
}
