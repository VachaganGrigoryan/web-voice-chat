import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ContextMenuRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const MENU_WIDTH = 236;
const MENU_HEIGHT = 360;
const VIEWPORT_PADDING = 12;
const DESKTOP_GAP = 10;

/**
 * Anchors a row context menu: centred on mobile, clamped inside the viewport and
 * flipped above the row when there is no room below on desktop.
 */
export function getContextMenuStyle(rect: ContextMenuRect, isMobile: boolean) {
  if (typeof window === 'undefined') return {};

  if (isMobile) {
    return {
      width: `min(${MENU_WIDTH}px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    } as const;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferredLeft = rect.right - MENU_WIDTH;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, preferredLeft),
    viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
  );

  const hasRoomBelow =
    rect.bottom + DESKTOP_GAP + MENU_HEIGHT <= viewportHeight - VIEWPORT_PADDING;
  const top = hasRoomBelow
    ? rect.bottom + DESKTOP_GAP
    : Math.max(VIEWPORT_PADDING, rect.top - DESKTOP_GAP - MENU_HEIGHT);

  return { width: MENU_WIDTH, left, top } as const;
}

export function MenuInfoHint() {
  return (
    <span
      aria-hidden="true"
      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

interface ContextMenuPanelProps {
  rect: ContextMenuRect | null;
  isMobile: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  children: ReactNode;
}

/** Portal + scrim + outside-click/Escape dismissal for a row context menu. */
export function ContextMenuPanel({
  rect,
  isMobile,
  onOpenChange,
  ariaLabel,
  children,
}: ContextMenuPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rect) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) return;
      onOpenChange(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [rect, onOpenChange]);

  const style = useMemo(
    () => (rect ? getContextMenuStyle(rect, isMobile) : {}),
    [rect, isMobile]
  );

  if (!rect || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn(
          'absolute inset-0',
          isMobile ? 'bg-black/20 backdrop-blur-[1px]' : 'bg-transparent'
        )}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="menu"
        aria-label={ariaLabel}
        className="absolute rounded-2xl border border-border/70 bg-background/98 p-2 shadow-2xl backdrop-blur"
        style={style}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

interface ContextMenuItemProps {
  icon: ReactNode;
  label: string;
  hint: string;
  disabled?: boolean;
  busy?: boolean;
  destructive?: boolean;
  onSelect: () => void;
}

export function ContextMenuItem({
  icon,
  label,
  hint,
  disabled = false,
  busy = false,
  destructive = false,
  onSelect,
}: ContextMenuItemProps) {
  return (
    <div className="group" title={hint}>
      <button
        type="button"
        role="menuitem"
        disabled={disabled || busy}
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
          disabled || busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/80'
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            destructive ? 'bg-destructive/10 text-destructive' : 'bg-muted/80'
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 text-sm font-medium',
            destructive ? 'text-destructive' : 'text-foreground'
          )}
        >
          {label}
        </span>
        <MenuInfoHint />
      </button>
    </div>
  );
}
