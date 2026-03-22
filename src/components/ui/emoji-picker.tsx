import * as React from 'react';
import { EmojiPicker } from 'frimousse';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AppEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  height?: number | string;
  showSearch?: boolean;
  showPreview?: boolean;
  showSkinToneSelector?: boolean;
  className?: string;
}

const pickerListComponents = {
  CategoryHeader: ({
    category,
    className,
    ...props
  }: React.ComponentProps<'div'> & { category: { label: string } }) => (
    <div
      className={cn(
        'bg-background/95 px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm',
        className
      )}
      {...props}
    >
      {category.label}
    </div>
  ),
  Row: ({ className, ...props }: React.ComponentProps<'div'>) => (
    <div className={cn('scroll-my-1.5 px-1.5', className)} {...props} />
  ),
  Emoji: ({
    emoji,
    className,
    ...props
  }: React.ComponentProps<'button'> & {
    emoji: { emoji: string; isActive: boolean };
  }) => (
    <button
      type="button"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-xl text-[1.15rem] transition-colors hover:bg-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 data-[active]:bg-accent',
        className
      )}
      {...props}
    >
      {emoji.emoji}
    </button>
  ),
};

export function AppEmojiPicker({
  onSelectEmoji,
  height = 360,
  showSearch = true,
  showPreview = true,
  showSkinToneSelector = true,
  className,
}: AppEmojiPickerProps) {
  const style = React.useMemo<React.CSSProperties>(
    () => ({
      height: typeof height === 'number' ? `${height}px` : height,
    }),
    [height]
  );

  return (
    <EmojiPicker.Root
      locale="en"
      columns={8}
      emojibaseUrl="/emojibase"
      onEmojiSelect={({ emoji }) => onSelectEmoji(emoji)}
      className={cn(
        'flex w-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-border/70 bg-background shadow-sm',
        className
      )}
      style={style}
    >
      {showSearch ? (
        <div className="border-b border-border/60 p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <EmojiPicker.Search
              className="h-10 w-full rounded-xl border border-border/60 bg-muted/30 py-2 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/30 focus:bg-background"
              placeholder="Search emoji"
              aria-label="Search emoji"
            />
          </div>
        </div>
      ) : null}

      <EmojiPicker.Viewport className="min-h-0 flex-1 overscroll-contain px-1.5 pb-1.5">
        <EmojiPicker.Loading className="flex h-full min-h-32 items-center justify-center px-4 text-sm text-muted-foreground">
          Loading emoji…
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="flex h-full min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
          {({ search }) =>
            search ? `No emoji found for "${search}".` : 'No emoji found.'
          }
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none"
          components={pickerListComponents}
        />
      </EmojiPicker.Viewport>

      {showPreview || showSkinToneSelector ? (
        <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-3 py-2">
          {showPreview ? (
            <EmojiPicker.ActiveEmoji>
              {({ emoji }) => (
                <div className="min-w-0 flex-1">
                  {emoji ? (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-lg leading-none">{emoji.emoji}</span>
                      <span className="truncate text-foreground/90">
                        {emoji.label}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Hover or use arrow keys to preview.
                    </span>
                  )}
                </div>
              )}
            </EmojiPicker.ActiveEmoji>
          ) : (
            <div className="flex-1" />
          )}

          {showSkinToneSelector ? (
            <EmojiPicker.SkinToneSelector
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-base shadow-sm transition-colors hover:bg-accent"
              aria-label="Change skin tone"
            />
          ) : null}
        </div>
      ) : null}
    </EmojiPicker.Root>
  );
}
