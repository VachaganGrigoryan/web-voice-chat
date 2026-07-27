import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

import { channelsApi, feedsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { FeedPostView } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

function formatPostTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function authorName(post: FeedPostView) {
  return post.author.display_name || post.author.username || 'User';
}

function PostAttachments({ post }: { post: FeedPostView }) {
  if (post.attachments.length === 0) return null;
  return (
    <div className="space-y-2">
      {post.attachments.map((media, index) =>
        media.kind === 'image' ? (
          <img
            key={`${media.key}-${index}`}
            src={media.url}
            alt={post.text || 'Post image'}
            className="max-h-96 w-full rounded-xl border border-border object-cover"
            loading="lazy"
          />
        ) : (
          <a
            key={`${media.key}-${index}`}
            href={media.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {media.kind} attachment
          </a>
        )
      )}
    </div>
  );
}

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
              <AvatarImage src={comment.author.avatar.url} alt={authorName(comment)} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-[11px]">
              {authorName(comment)[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 rounded-2xl bg-muted/50 px-3 py-2">
            <div className="text-xs font-medium text-foreground">{authorName(comment)}</div>
            <div className="whitespace-pre-wrap break-words text-sm text-foreground">
              {comment.is_deleted ? <span className="italic text-muted-foreground">deleted</span> : comment.text}
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
}

export function ProfilePostCard({ post, channelId, canComment }: ProfilePostCardProps) {
  const [showComments, setShowComments] = useState(false);

  const totalReactions = post.reactions.reduce((sum, group) => sum + group.count, 0);

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {post.author.avatar?.url ? (
            <AvatarImage src={post.author.avatar.url} alt={authorName(post)} className="object-cover" />
          ) : null}
          <AvatarFallback>{authorName(post)[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{authorName(post)}</div>
          <div className="text-xs text-muted-foreground">
            {formatPostTime(post.created_at)}
            {post.edited_at ? ' · edited' : ''}
          </div>
        </div>
      </header>

      {post.is_deleted ? (
        <p className="text-sm italic text-muted-foreground">This post was deleted.</p>
      ) : (
        <div className="space-y-3">
          {post.text ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{post.text}</p>
          ) : null}
          <PostAttachments post={post} />
        </div>
      )}

      {!post.is_deleted ? (
        <footer className="mt-3 flex items-center gap-4 border-t border-border pt-2 text-xs text-muted-foreground">
          {post.reactions.length > 0 ? (
            <span className="flex items-center gap-1">
              {post.reactions.slice(0, 3).map((group) => (
                <span key={group.emoji}>{group.emoji}</span>
              ))}
              <span>{totalReactions}</span>
            </span>
          ) : null}
          {canComment || post.has_thread || post.comment_count > 0 ? (
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 hover:text-foreground"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
            </button>
          ) : null}
        </footer>
      ) : null}

      {showComments ? (
        <PostComments
          channelId={channelId}
          postId={post.id}
          canComment={canComment}
        />
      ) : null}
    </article>
  );
}
