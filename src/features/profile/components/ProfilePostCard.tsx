import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { channelsApi, feedsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { FeedPostView } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PostCard, authorName } from '@/features/feed/PostCard';

/**
 * A post with its comment thread wired up.
 *
 * The card itself is `PostCard` — the shared shell over the shared content
 * core. This file keeps only what is genuinely about comments, and keeps its
 * export name and props so the home feed, saved feed, post detail route and
 * channel timeline are untouched.
 */

function PostComments({
  channelId,
  postId,
  canComment,
}: {
  channelId: string;
  postId: string;
  canComment: boolean;
}) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['post-comments', channelId, postId],
    queryFn: () => feedsApi.getPostComments(channelId, postId),
  });
  const comments = data?.data ?? [];
  const commentMutation = useMutation({
    mutationFn: (text: string) =>
      channelsApi.createMessage(channelId, {
        text,
        reply_mode: 'thread',
        reply_to_message_id: postId,
      }),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['post-comments', channelId, postId] });
      queryClient.invalidateQueries({ queryKey: ['channel-feed', channelId] });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not add comment')),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading comments…
      </div>
    );
  }
  if (isError) {
    return <p className="pt-2 text-xs text-muted-foreground">Failed to load comments.</p>;
  }

  return (
    <div className="space-y-2 pt-3">
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      ) : null}
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-2">
          <Avatar className="h-7 w-7 shrink-0">
            {comment.author.avatar?.url ? (
              <AvatarImage
                src={comment.author.avatar.url}
                alt={authorName(comment)}
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="text-[11px]">
              {authorName(comment)[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 rounded-2xl bg-muted/50 px-3 py-2">
            <div className="text-xs font-medium">{authorName(comment)}</div>
            <div className="whitespace-pre-wrap break-words text-sm">
              {comment.is_deleted ? (
                <span className="italic text-muted-foreground">deleted</span>
              ) : (
                comment.text
              )}
            </div>
          </div>
        </div>
      ))}
      {canComment ? (
        <div className="flex items-end gap-2 pt-2">
          <label htmlFor={`comment-${postId}`} className="sr-only">
            Add a comment
          </label>
          <textarea
            id={`comment-${postId}`}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={2}
            placeholder="Write a comment…"
            className="min-w-0 flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            size="icon"
            aria-label="Post comment"
            disabled={!commentText.trim() || commentMutation.isPending}
            onClick={() => commentMutation.mutate(commentText.trim())}
          >
            {commentMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

interface ProfilePostCardProps {
  post: FeedPostView;
  channelId: string;
  canComment: boolean;
  canReact?: boolean;
  currentUserId?: string | null;
  defaultShowComments?: boolean;
}

export function ProfilePostCard({
  post,
  channelId,
  canComment,
  canReact = false,
  currentUserId,
  defaultShowComments = false,
}: ProfilePostCardProps) {
  return (
    <PostCard
      post={post}
      canComment={canComment}
      canReact={canReact}
      currentUserId={currentUserId}
      defaultShowComments={defaultShowComments}
      comments={
        <PostComments channelId={channelId} postId={post.id} canComment={canComment} />
      }
    />
  );
}
