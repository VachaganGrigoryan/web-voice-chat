import { useInfiniteQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { feedsApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { ProfilePostCard } from '@/features/profile/components/ProfilePostCard';

const PAGE_SIZE = 30;

export type FeedScope =
  | { kind: 'home' }
  | { kind: 'user'; username: string }
  | { kind: 'channel'; channelId: string };

function feedScopeKey(scope: FeedScope) {
  if (scope.kind === 'home') return ['feeds', 'home'] as const;
  if (scope.kind === 'user') return ['feeds', 'user', scope.username] as const;
  return ['feeds', 'channel', scope.channelId] as const;
}

function loadFeed(scope: FeedScope, cursor?: string) {
  if (scope.kind === 'home') {
    return feedsApi.getHome(PAGE_SIZE, cursor);
  }
  if (scope.kind === 'user') {
    return feedsApi.getUserFeed(scope.username, PAGE_SIZE, cursor);
  }
  return feedsApi.getChannel(scope.channelId, PAGE_SIZE, cursor);
}

export function FeedList({ scope }: { scope: FeedScope }) {
  const query = useInfiniteQuery({
    queryKey: feedScopeKey(scope),
    queryFn: ({ pageParam }) => loadFeed(scope, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
  });
  const posts = query.data?.pages.flatMap((page) => page.data) ?? [];

  if (query.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        Failed to load this feed.
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        No posts yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <ProfilePostCard
          key={`${post.channel_id}:${post.id}`}
          post={post}
          channelId={post.channel_id}
          canComment={false}
        />
      ))}
      {query.hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Load older posts
          </Button>
        </div>
      ) : null}
    </div>
  );
}
