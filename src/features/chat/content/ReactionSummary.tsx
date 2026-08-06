import { cn } from '@/lib/utils';
import type { MessageReactionGroup } from '@/api/types';

interface ReactionSummaryProps {
  reactions: readonly MessageReactionGroup[];
  /** Present when the viewer may react; absent renders a read-only summary. */
  onToggle?: (emoji: string) => void;
  currentUserId?: string | null;
  className?: string;
}

/**
 * Reaction pills over the same `MessageReactionGroup[]` both the message API
 * and the feed projection return, so a post and a message count reactions the
 * same way. Absent `onToggle` means the viewer may not react — the pills stay
 * readable rather than becoming dead buttons.
 */
export function ReactionSummary({
  reactions,
  onToggle,
  currentUserId,
  className,
}: ReactionSummaryProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {reactions.map((group) => {
        const isMine = !!currentUserId && group.user_ids.includes(currentUserId);
        const label = `${group.emoji} ${group.count}`;

        if (!onToggle) {
          return (
            <span
              key={group.emoji}
              className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-xs"
            >
              <span aria-hidden>{group.emoji}</span>
              <span className="sr-only">{label}</span>
              <span aria-hidden>{group.count}</span>
            </span>
          );
        }

        return (
          <button
            key={group.emoji}
            type="button"
            aria-pressed={isMine}
            aria-label={label}
            onClick={() => onToggle(group.emoji)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isMine
                ? 'bg-brand-muted text-brand'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span aria-hidden>{group.emoji}</span>
            <span aria-hidden>{group.count}</span>
          </button>
        );
      })}
    </div>
  );
}
