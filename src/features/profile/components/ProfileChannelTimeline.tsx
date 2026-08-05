import { useState } from 'react';
import { Loader2, PenSquare } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useChannelFeed } from '@/hooks/useChannelFeed';
import { AddPostModal } from '@/features/feed/AddPostModal';
import { useFeedPostCapabilities } from '@/features/feed/useFeedPostCapabilities';
import { useAuthStore } from '@/store/authStore';

import { ProfilePostCard } from './ProfilePostCard';

interface ProfileChannelTimelineProps {
  channelId: string;
}

/**
 * A channel read as a feed.
 *
 * Affordances come from resolved capabilities, not from reading
 * `posting_policy` / `comment_policy` at the call site — that duplication was
 * the reason the feed and the chat lens could disagree about what the same
 * viewer was allowed to do in the same channel.
 */
export function ProfileChannelTimeline({ channelId }: ProfileChannelTimelineProps) {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const currentUserId = useAuthStore((state) => state.userId);
  const { for: capabilitiesFor } = useFeedPostCapabilities([channelId]);
  const { canPost, canComment, canReact } = capabilitiesFor(channelId);

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelFeed(channelId);

  // Backend already returns newest-first; keep that order for a timeline.
  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-4">
      {canPost ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full cursor-pointer justify-start rounded-2xl py-6 text-muted-foreground"
            onClick={() => setIsComposerOpen(true)}
          >
            <PenSquare className="mr-2 h-4 w-4" />
            What do you want to share?
          </Button>
          <AddPostModal
            channelId={channelId}
            open={isComposerOpen}
            onOpenChange={setIsComposerOpen}
          />
        </>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Failed to load posts.
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {canPost ? 'No posts yet. Share your first post above.' : 'No posts yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <ProfilePostCard
              key={post.id}
              post={post}
              channelId={channelId}
              canComment={canComment}
              canReact={canReact}
              currentUserId={currentUserId}
            />
          ))}
          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load older posts
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
