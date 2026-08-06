import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Smile } from 'lucide-react';
import { AppEmojiPicker } from '@/components/ui/emoji-picker';
import { cn } from '@/lib/utils';

export const QUICK_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥'] as const;

type ReactionPanelView = 'closed' | 'quick' | 'picker';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void | Promise<void>;
  disabled?: boolean;
  /** Which edge of the trigger the panel hangs from, for an own message vs a peer's. */
  align?: 'start' | 'end';
  className?: string;
}

const VIEWPORT_PADDING = 12;
const QUICK_PANEL_WIDTH = 304;
const PICKER_PANEL_WIDTH = 352;

const getPanelStyle = (
  anchorRect: DOMRect | null,
  view: Exclude<ReactionPanelView, 'closed'>,
  align: 'start' | 'end'
) => {
  if (typeof window === 'undefined') {
    return {};
  }

  const mobile = window.innerWidth < 768;

  if (mobile) {
    return {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: `min(${view === 'picker' ? PICKER_PANEL_WIDTH : QUICK_PANEL_WIDTH}px, calc(100vw - ${
        VIEWPORT_PADDING * 2
      }px))`,
      zIndex: 70,
    } as const;
  }

  const width = view === 'picker' ? PICKER_PANEL_WIDTH : QUICK_PANEL_WIDTH;
  const height = view === 'picker' ? 440 : 60;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const reference = anchorRect;

  if (!reference) {
    return {
      position: 'fixed',
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING,
      width,
      zIndex: 70,
    } as const;
  }

  const preferredLeft = align === 'end' ? reference.right - width : reference.left;
  let left = Math.min(
    Math.max(VIEWPORT_PADDING, preferredLeft),
    viewportWidth - width - VIEWPORT_PADDING
  );

  const aboveTop = reference.top - height - 10;
  const belowTop = reference.bottom + 10;
  let top = aboveTop >= VIEWPORT_PADDING
    ? aboveTop
    : Math.min(belowTop, viewportHeight - height - VIEWPORT_PADDING);

  left = Number.isFinite(left) ? left : VIEWPORT_PADDING;
  top = Number.isFinite(top) ? top : VIEWPORT_PADDING;

  return {
    position: 'fixed',
    left,
    top,
    width,
    zIndex: 70,
  } as const;
};

/**
 * The one reaction picker: a trigger plus a portalled panel that opens on the
 * quick row and expands to the full emoji set.
 *
 * It owns its trigger because it owns the anchor, and it knows nothing about
 * messages — which is what lets the chat row and a feed post footer offer the
 * same set of emoji with the same positioning rather than two of each.
 */
export function ReactionPicker({
  onSelect,
  disabled = false,
  align = 'start',
  className,
}: ReactionPickerProps) {
  const [view, setView] = useState<ReactionPanelView>('closed');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const panelStyle = useMemo(
    () => getPanelStyle(anchorRect, view === 'closed' ? 'quick' : view, align),
    [align, anchorRect, view]
  );

  useEffect(() => {
    if (view === 'closed') {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (panelRef.current?.contains(target) || triggerRef.current?.contains(target))) {
        return;
      }

      setView('closed');
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setView('closed');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [view]);

  useEffect(() => {
    if (view === 'closed') return;
    const updateAnchor = () => {
      if (!triggerRef.current) return;
      setAnchorRect(triggerRef.current.getBoundingClientRect());
    };

    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [view]);

  const handleReactionSelect = async (emoji: string) => {
    await onSelect(emoji);
    setView('closed');
  };

  const renderReactionPanel = () => {
    if (view === 'closed' || typeof document === 'undefined') {
      return null;
    }

    return createPortal(
      <div
        ref={panelRef}
        className={cn(
          'overflow-hidden border border-border/70 bg-background/98 shadow-2xl backdrop-blur-xl',
          view === 'quick' ? 'rounded-full px-2 py-1.5' : 'rounded-3xl'
        )}
        style={panelStyle}
      >
        {view === 'quick' ? (
          <div className="flex items-center gap-1">
            {QUICK_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={disabled}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-muted',
                  disabled && 'cursor-not-allowed opacity-70'
                )}
                onClick={() => void handleReactionSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'ml-1 flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-border/70 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-70'
              )}
              onClick={() => setView('picker')}
              aria-label="More reactions"
              title="More reactions"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">Add Reaction</div>
                <div className="mt-1 text-xs text-muted-foreground">Choose any emoji.</div>
              </div>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setView('quick')}
              >
                Back
              </button>
            </div>
            <AppEmojiPicker
              onSelectEmoji={(emoji) => {
                void handleReactionSelect(emoji);
              }}
              height={360}
              showPreview={false}
              showSkinToneSelector={false}
              className="w-full rounded-2xl border border-border/60 shadow-none"
            />
          </div>
        )}
      </div>,
      document.body
    );
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          'inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border/70 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground transition-all touch-manipulation hover:bg-muted/80 hover:text-foreground',
          view !== 'closed' && 'border-primary/40 bg-primary/8 text-primary md:opacity-100',
          disabled && 'cursor-not-allowed opacity-70',
          className
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setAnchorRect(event.currentTarget.getBoundingClientRect());
          setView((current) => (current === 'closed' ? 'quick' : 'closed'));
        }}
        aria-label="React"
        title="React"
      >
        <Smile className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">React</span>
      </button>

      {renderReactionPanel()}
    </>
  );
}
