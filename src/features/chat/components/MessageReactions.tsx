import { cn } from '@/lib/utils';
import { ReactionPicker } from '../content/ReactionPicker';
import { ChatMessage } from '../types/message';

interface MessageReactionsProps {
  message: ChatMessage;
  currentUserId?: string | null;
  /** Resolved from the container's capabilities; absent means no affordance at all. */
  canReact: boolean;
  onToggleReaction: (emoji: string) => void | Promise<void>;
  isBusy?: boolean;
  className?: string;
}

export function MessageReactions({
  message,
  currentUserId,
  canReact,
  onToggleReaction,
  isBusy = false,
  className,
}: MessageReactionsProps) {
  const reactions = message.reactions || [];

  if (reactions.length === 0 && (!canReact || message.kind === 'system')) {
    return null;
  }

  const trigger = canReact ? (
    <ReactionPicker
      onSelect={onToggleReaction}
      disabled={isBusy}
      align={message.isOwn ? 'end' : 'start'}
    />
  ) : null;

  return (
    <>
      {reactions.length > 0 ? (
        <div
          className={cn(
            'mt-0.5 flex flex-wrap items-center gap-1 px-1',
            message.isOwn ? 'justify-end' : 'justify-start',
            className
          )}
        >
          {reactions.map((reaction) => {
            const hasOwnReaction = !!currentUserId && reaction.user_ids.includes(currentUserId);
            const chipClassName = cn(
              'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors touch-manipulation',
              hasOwnReaction
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border/70 bg-background/80 text-foreground/80',
              canReact && !hasOwnReaction && 'hover:bg-muted/80',
              isBusy && 'cursor-not-allowed opacity-70'
            );

            // A viewer who may not react reads the counts rather than pressing
            // dead buttons -- the same split `ReactionSummary` makes.
            if (!canReact) {
              return (
                <span key={`${message.id}-${reaction.emoji}`} className={chipClassName}>
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </span>
              );
            }

            return (
              <button
                key={`${message.id}-${reaction.emoji}`}
                type="button"
                disabled={isBusy}
                className={chipClassName}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onToggleReaction(reaction.emoji);
                }}
              >
                <span>{reaction.emoji}</span>
                <span>{reaction.count}</span>
              </button>
            );
          })}

          {trigger}
        </div>
      ) : (
        <div
          className={cn(
            'relative h-0 w-full px-1',
            message.isOwn ? 'self-end' : 'self-start',
            className
          )}
        >
          <div
            className={cn(
              'absolute -top-2 z-10',
              message.isOwn ? 'right-1' : 'left-1',
              'opacity-100 md:opacity-0 md:group-hover:opacity-100'
            )}
          >
            {trigger}
          </div>
        </div>
      )}
    </>
  );
}
