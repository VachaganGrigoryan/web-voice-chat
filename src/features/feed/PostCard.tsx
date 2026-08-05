import { useState, type ReactNode } from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import type { FeedPostView } from '@/api/types';
import { MediaAttachmentList, type MediaClickTarget } from '@/features/chat/content/MediaAttachmentList';
import { ReactionSummary } from '@/features/chat/content/ReactionSummary';
import { MessageTextContent } from '@/features/chat/content/MessageTextContent';
import { MessagePollContent } from '@/features/chat/content/MessagePollContent';
import { resolvePostStyle } from '@/features/chat/composer/postStyles';

export const authorName = (post: { author: FeedPostView['author'] }) =>
  post.author.display_name || post.author.username || 'User';

const formatPostTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );

interface PostCardProps {
  post: FeedPostView;
  canComment: boolean;
  canReact?: boolean;
  currentUserId?: string | null;
  onToggleReaction?: (emoji: string) => void;
  onMediaClick?: (target: MediaClickTarget) => void;
  /** The comment thread, supplied by the caller so the shell stays presentational. */
  comments?: ReactNode;
  defaultShowComments?: boolean;
  className?: string;
}

/**
 * The feed shell for a post: an author header, the shared content core, and a
 * comment thread. The chat shell for the same content is `MessageBubble`; both
 * render the same body, which is what `presentation.rootItem` selects between.
 *
 * It takes resolved capability booleans rather than a container descriptor,
 * because a home feed's posts come from many channels and have no single
 * container. It never reads a policy string.
 */
export function PostCard({
  post,
  canComment,
  canReact = false,
  currentUserId,
  onToggleReaction,
  onMediaClick,
  comments,
  defaultShowComments = false,
  className,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(defaultShowComments);
  const name = authorName(post);
  // An unrecognised background id degrades to plain rather than blanking.
  const style = resolvePostStyle(post.style?.background);

  return (
    <article className={cn('rounded-2xl border border-border bg-card p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-start gap-3">
        <Avatar className="h-9 w-9 shrink-0">
          {post.author.avatar?.url ? (
            <AvatarImage src={post.author.avatar.url} alt={name} className="object-cover" />
          ) : null}
          <AvatarFallback>{name[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{name}</div>
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
          {/* A poll post renders through the same content component the chat
              lens uses; the feed projection carries `poll_ref` for exactly this. */}
          {post.poll_ref ? (
            <MessagePollContent
              pollId={post.poll_ref.poll_id}
              question={post.poll_ref.question}
            />
          ) : post.text ? (
            style.id !== 'plain' ? (
              // A styled post is its own block: the background is the point, so
              // it is not rendered through the markdown body's prose styles.
              <div
                className={cn(
                  'flex min-h-40 items-center justify-center rounded-xl px-6 py-8 text-center text-lg font-semibold leading-8',
                  style.className
                )}
              >
                <span className="whitespace-pre-wrap break-words">{post.text}</span>
              </div>
            ) : (
              <MessageTextContent
                text={post.text}
                tone="surface"
                mentionCount={post.mention_user_ids?.length ?? 0}
                mentionScope={post.mention_scope}
                className="text-sm leading-6"
              />
            )
          ) : null}
          <MediaAttachmentList
            attachments={post.attachments}
            captionText={post.text}
            onMediaClick={onMediaClick}
          />
        </div>
      )}

      {!post.is_deleted ? (
        <footer className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <ReactionSummary
            reactions={post.reactions}
            currentUserId={currentUserId}
            onToggle={canReact ? onToggleReaction : undefined}
          />
          {canComment || post.has_thread || post.comment_count > 0 ? (
            <button
              type="button"
              aria-expanded={showComments}
              onClick={() => setShowComments((open) => !open)}
              className="flex min-h-11 cursor-pointer items-center gap-1.5 transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {post.comment_count} {post.comment_count === 1 ? 'comment' : 'comments'}
            </button>
          ) : null}
        </footer>
      ) : null}

      {showComments ? comments : null}
    </article>
  );
}
