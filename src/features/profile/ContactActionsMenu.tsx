import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContactMenuItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ContactActionsMenuProps {
  open: boolean;
  isMobile: boolean;
  anchorRect: DOMRect | null;
  title?: string;
  items: ContactMenuItem[];
  onClose: () => void;
}

const MENU_WIDTH = 248;
const VIEWPORT_PADDING = 12;
const DESKTOP_GAP = 8;
const EST_ITEM_HEIGHT = 52;

function getDesktopStyle(anchorRect: DOMRect, itemCount: number) {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const estHeight = itemCount * EST_ITEM_HEIGHT + 16;

  const preferredLeft = anchorRect.right - MENU_WIDTH;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, preferredLeft),
    viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
  );

  const hasRoomBelow =
    anchorRect.bottom + DESKTOP_GAP + estHeight <= viewportHeight - VIEWPORT_PADDING;
  const top = hasRoomBelow
    ? anchorRect.bottom + DESKTOP_GAP
    : Math.max(VIEWPORT_PADDING, anchorRect.top - DESKTOP_GAP - estHeight);

  return { width: MENU_WIDTH, left, top } as const;
}

export function ContactActionsMenu({
  open,
  isMobile,
  anchorRect,
  title,
  items,
  onClose,
}: ContactActionsMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      onClose();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  const desktopStyle = useMemo(
    () => (!isMobile && anchorRect ? getDesktopStyle(anchorRect, items.length) : undefined),
    [isMobile, anchorRect, items.length]
  );

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          'absolute inset-0',
          isMobile ? 'bg-black/30 backdrop-blur-[1px]' : 'bg-transparent'
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="menu"
        className={cn(
          'absolute border border-border/70 bg-background shadow-2xl',
          isMobile
            ? 'inset-x-0 bottom-0 rounded-t-3xl p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
            : 'rounded-2xl p-2 backdrop-blur'
        )}
        style={isMobile ? undefined : desktopStyle}
      >
        {isMobile ? (
          <div className="flex flex-col items-center gap-2 px-2 pb-1 pt-2">
            <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            {title ? (
              <span className="text-xs font-medium text-muted-foreground">{title}</span>
            ) : null}
          </div>
        ) : null}
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={cn(
                'flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                item.disabled
                  ? 'cursor-not-allowed opacity-60'
                  : item.destructive
                    ? 'cursor-pointer text-destructive hover:bg-destructive/10'
                    : 'cursor-pointer hover:bg-muted/80'
              )}
              onClick={() => {
                if (item.disabled) return;
                onClose();
                item.onSelect();
              }}
            >
              <span
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                  item.destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted/80'
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
