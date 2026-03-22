import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationMenuRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ConversationMenuState {
  peerUserId: string;
  unreadCount: number;
  rect: ConversationMenuRect;
}

interface ConversationActionsMenuProps {
  menu: ConversationMenuState | null;
  isMobile: boolean;
  isMarkingRead: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsRead: (peerUserId: string) => void | Promise<void>;
}

const MENU_WIDTH = 236;
const MENU_HEIGHT = 96;
const VIEWPORT_PADDING = 12;
const DESKTOP_GAP = 10;

function getMenuStyle(menu: ConversationMenuState, isMobile: boolean) {
  if (typeof window === 'undefined') {
    return {};
  }

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

  const preferredLeft = menu.rect.right - MENU_WIDTH;
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, preferredLeft),
    viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
  );

  const hasRoomBelow = menu.rect.bottom + DESKTOP_GAP + MENU_HEIGHT <= viewportHeight - VIEWPORT_PADDING;
  const top = hasRoomBelow
    ? menu.rect.bottom + DESKTOP_GAP
    : Math.max(VIEWPORT_PADDING, menu.rect.top - DESKTOP_GAP - MENU_HEIGHT);

  return {
    width: MENU_WIDTH,
    left,
    top,
  } as const;
}

export function ConversationActionsMenu({
  menu,
  isMobile,
  isMarkingRead,
  onOpenChange,
  onMarkAsRead,
}: ConversationActionsMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [menu, onOpenChange]);

  const menuStyle = useMemo(() => (menu ? getMenuStyle(menu, isMobile) : {}), [isMobile, menu]);

  if (!menu || typeof document === 'undefined') {
    return null;
  }

  const markAsReadDisabled = isMarkingRead || menu.unreadCount === 0;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn('absolute inset-0', isMobile ? 'bg-black/20 backdrop-blur-[1px]' : 'bg-transparent')}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="menu"
        className="absolute overflow-hidden rounded-2xl border border-border/70 bg-background/98 p-2 shadow-2xl backdrop-blur"
        style={menuStyle}
      >
        <button
          type="button"
          role="menuitem"
          disabled={markAsReadDisabled}
          className={cn(
            'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors',
            markAsReadDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/80'
          )}
          onClick={() => {
            void onMarkAsRead(menu.peerUserId);
          }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80">
            <CheckCheck className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">Mark conversation as read</span>
            <span className="block text-xs text-muted-foreground">
              {menu.unreadCount > 0 ? `${menu.unreadCount} unread message${menu.unreadCount === 1 ? '' : 's'}` : 'Already up to date'}
            </span>
          </span>
        </button>
      </div>
    </div>,
    document.body
  );
}
