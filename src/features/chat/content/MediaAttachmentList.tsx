import { FileText, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MediaMeta } from '@/api/types';

export interface MediaClickTarget {
  readonly type: 'image' | 'video';
  readonly url: string;
  readonly downloadName?: string;
}

interface MediaAttachmentListProps {
  attachments: readonly MediaMeta[];
  /** Used as the alt text fallback so a gallery is not a row of "image". */
  captionText?: string | null;
  onMediaClick?: (target: MediaClickTarget) => void;
  className?: string;
}

/**
 * Shell-agnostic attachment rendering: it takes `MediaMeta[]` and nothing else,
 * so a chat bubble and a post card show the same gallery from the same code.
 * This is the duplication that let the feed's attachments drift into a plain
 * stacked `<img>` list while chat had a collage.
 */
export function MediaAttachmentList({
  attachments,
  captionText,
  onMediaClick,
  className,
}: MediaAttachmentListProps) {
  if (attachments.length === 0) return null;

  const visuals = attachments.filter((media) => media.kind === 'image' || media.kind === 'video');
  const others = attachments.filter((media) => media.kind !== 'image' && media.kind !== 'video');

  return (
    <div className={cn('space-y-2', className)}>
      {visuals.length > 0 ? (
        <div
          className={cn(
            'grid gap-1.5 overflow-hidden rounded-xl',
            visuals.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}
        >
          {visuals.map((media, index) => {
            const isVideo = media.kind === 'video';
            const isLoneOdd = visuals.length % 2 === 1 && index === visuals.length - 1;

            return (
              <button
                key={`${media.key}-${index}`}
                type="button"
                onClick={() =>
                  onMediaClick?.({
                    type: isVideo ? 'video' : 'image',
                    url: media.url,
                    downloadName: media.key,
                  })
                }
                className={cn(
                  'group relative cursor-pointer overflow-hidden bg-muted/40',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  visuals.length > 1 && isLoneOdd && 'col-span-2'
                )}
              >
                <img
                  src={media.url}
                  alt={captionText || (isVideo ? 'Video attachment' : 'Image attachment')}
                  loading="lazy"
                  className={cn(
                    'w-full object-cover transition-opacity duration-200 group-hover:opacity-90',
                    visuals.length === 1 ? 'max-h-[28rem]' : 'aspect-square'
                  )}
                />
                {isVideo ? (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center bg-black/25"
                  >
                    <Play className="h-10 w-10 text-white drop-shadow" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {others.map((media, index) => (
        <a
          key={`${media.key}-${index}`}
          href={media.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{media.key.split('/').pop() || `${media.kind} attachment`}</span>
        </a>
      ))}
    </div>
  );
}
