import { cn } from '@/lib/utils';
import { MessageMarkdown } from '../components/MessageMarkdown';

/**
 * How a body is tinted.
 *
 * `isOwn` used to drive this, which conflated two different questions — which
 * side of the timeline a bubble sits on (a shell concern) and whether the body
 * sits on an accent surface (a content concern). A post card has no "own" side
 * but does need the second answer, so content components take a tone.
 */
export type ContentTone = 'surface' | 'accent';

interface MessageTextContentProps {
  text: string;
  tone?: ContentTone;
  mentionCount?: number;
  mentionScope?: 'here' | 'all' | null;
  className?: string;
}

/** The text body, shell-agnostic: no bubble, no ownership, no source document. */
export function MessageTextContent({
  text,
  tone = 'surface',
  mentionCount = 0,
  mentionScope,
  className,
}: MessageTextContentProps) {
  const hasMentionBadge = Boolean(mentionScope) || mentionCount > 0;

  return (
    <div className={className}>
      {hasMentionBadge ? (
        <div className="mb-1 flex flex-wrap gap-1">
          {mentionScope ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                tone === 'accent' ? 'bg-white/20 text-current' : 'bg-primary/10 text-primary'
              )}
            >
              @{mentionScope}
            </span>
          ) : null}
          {mentionCount > 0 ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                tone === 'accent' ? 'bg-white/20 text-current' : 'bg-primary/10 text-primary'
              )}
            >
              {mentionCount} mention{mentionCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      ) : null}
      <MessageMarkdown text={text} isOwn={tone === 'accent'} />
    </div>
  );
}
