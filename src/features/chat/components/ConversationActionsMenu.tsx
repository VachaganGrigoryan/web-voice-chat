import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCheck, Info, Loader2, Trash2 } from 'lucide-react';
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
  isClearingConversation: boolean;
  isDeletingConversation: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkAsRead: (peerUserId: string) => void | Promise<void>;
  onClearConversation: (peerUserId: string) => void | Promise<void>;
  onDeleteConversation: (peerUserId: string) => void | Promise<void>;
}

const MENU_WIDTH = 236;
const MENU_HEIGHT = 180;
const VIEWPORT_PADDING = 12;
const DESKTOP_GAP = 10;

function MenuInfoHint() {
  return (
    <span
      aria-hidden="true"
      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground/80 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <Info className="h-3.5 w-3.5" />
    </span>
  );
}

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
  isClearingConversation,
  isDeletingConversation,
  onOpenChange,
  onMarkAsRead,
  onClearConversation,
  onDeleteConversation,
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
  const clearConversationDisabled = isClearingConversation || isDeletingConversation;
  const deleteConversationDisabled = isDeletingConversation || isClearingConversation;
  const markAsReadInfo =
    menu.unreadCount > 0
      ? `Mark ${menu.unreadCount} unread message${menu.unreadCount === 1 ? '' : 's'} as read.`
      : 'This chat is already up to date.';
  const clearChatInfo =
    'Remove your message history in this chat, but keep the conversation available.';
  const deleteChatInfo =
    'Remove this chat and delete the ping between both users. The other side may still see a ghost chat until they ping again.';

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className={cn('absolute inset-0', isMobile ? 'bg-black/20 backdrop-blur-[1px]' : 'bg-transparent')}
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="menu"
        className="absolute rounded-2xl border border-border/70 bg-background/98 p-2 shadow-2xl backdrop-blur"
        style={menuStyle}
      >
        <div className="group" title={markAsReadInfo}>
          <button
            type="button"
            role="menuitem"
            disabled={markAsReadDisabled}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
              markAsReadDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/80'
            )}
            onClick={() => {
              void onMarkAsRead(menu.peerUserId);
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80">
              <CheckCheck className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-foreground">Mark as read</span>
            <MenuInfoHint />
          </button>
        </div>

        <div className="group" title={clearChatInfo}>
          <button
            type="button"
            role="menuitem"
            disabled={clearConversationDisabled}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
              clearConversationDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/80'
            )}
            onClick={() => {
              void onClearConversation(menu.peerUserId);
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80">
              {isClearingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-foreground">Clear chat</span>
            <MenuInfoHint />
          </button>
        </div>

        <div className="group" title={deleteChatInfo}>
          <button
            type="button"
            role="menuitem"
            disabled={deleteConversationDisabled}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
              deleteConversationDisabled
                ? 'cursor-not-allowed opacity-60'
                : 'text-destructive hover:bg-destructive/10'
            )}
            onClick={() => {
              void onDeleteConversation(menu.peerUserId);
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              {isDeletingConversation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">Delete chat</span>
            <MenuInfoHint />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
