import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { channelsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { useChannelFeed } from '@/hooks/useChannelFeed';
import { useFollowTarget } from '@/hooks/useFollowRelationships';
import { useAuthStore } from '@/store/authStore';

import { ProfilePostCard } from './ProfilePostCard';

interface ProfilePostComposerProps {
  channelId: string;
}

function ProfilePostComposer({ channelId }: ProfilePostComposerProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const reset = () => {
    setText('');
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      return channelsApi.createMessage(channelId, { text: trimmed });
    },
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ['channel-feed', channelId] });
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not publish post')),
  });

  const canSend = text.trim().length > 0 && !publishMutation.isPending;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <label htmlFor="profile-post-input" className="sr-only">
        Write a post
      </label>
      <textarea
        id="profile-post-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Share something on your channel…"
        rows={3}
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => canSend && publishMutation.mutate()}
          disabled={!canSend}
        >
          {publishMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Post
        </Button>
      </div>
    </div>
  );
}

interface ProfileChannelTimelineProps {
  channelId: string;
}

export function ProfileChannelTimeline({ channelId }: ProfileChannelTimelineProps) {
  const currentUserId = useAuthStore((state) => state.userId);
  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId),
    enabled: Boolean(channelId),
  });
  const follow = useFollowTarget('channel', channelId);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelFeed(channelId);
  const channel = channelQuery.data;
  const isOwner = Boolean(
    currentUserId &&
      channel?.owner.type === 'user' &&
      channel.owner.id === currentUserId
  );
  const canPublish =
    Boolean(channel) &&
    (isOwner || channel?.posting_policy === 'everyone');
  const canComment =
    Boolean(channel) &&
    channel?.comment_policy !== 'disabled' &&
    (isOwner ||
      channel?.comment_policy === 'everyone' ||
      (channel?.comment_policy === 'followers' && follow.isFollowing));

  // Backend already returns newest-first; keep that order for a timeline.
  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-4">
      {canPublish ? <ProfilePostComposer channelId={channelId} /> : null}

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
          {canPublish ? 'No posts yet. Share your first post above.' : 'No posts yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <ProfilePostCard
              key={post.id}
              post={post}
              channelId={channelId}
              canComment={canComment}
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
