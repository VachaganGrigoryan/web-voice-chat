import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Clock,
  FolderInput,
  Loader2,
  MoreVertical,
  Phone,
  Pin,
  PinOff,
  Search,
  UserPlus,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Logo } from '@/shared/branding/Logo';
import { ProfileTriggerButton } from './ProfileTriggerButton';
import { ConversationType, NotificationLevel, PresenceState } from '@/api/types';

type HeaderActionId =
  | 'audio_call'
  | 'video_call'
  | 'invite'
  | 'search'
  | 'saved'
  | 'scheduled'
  | 'notifications'
  | 'chat_pin'
  | 'folder'
  | 'archive'
  | 'send_ping';

type HeaderActionContext = ConversationType;

interface HeaderAction {
  id: HeaderActionId;
  label: string;
  title: string;
  icon: LucideIcon;
  iconClassName?: string;
  disabled?: boolean;
  onSelect: () => void;
}

interface HeaderMenuRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type QuickActionPreferences = Partial<Record<HeaderActionContext, HeaderActionId[]>>;

const QUICK_ACTION_STORAGE_KEY = 'vogi.chat.header.quickActions.v1';
const HEADER_ACTION_IDS: readonly HeaderActionId[] = [
  'audio_call',
  'video_call',
  'invite',
  'search',
  'saved',
  'scheduled',
  'notifications',
  'chat_pin',
  'folder',
  'archive',
  'send_ping',
];
const HEADER_ACTION_ID_SET: ReadonlySet<string> = new Set(HEADER_ACTION_IDS);
const HEADER_ACTION_CONTEXTS: readonly HeaderActionContext[] = ['dm', 'group'];
const DEFAULT_QUICK_ACTIONS: Record<HeaderActionContext, HeaderActionId[]> = {
  dm: ['audio_call', 'video_call'],
  group: ['invite'],
};
const MAX_QUICK_ACTIONS: Record<HeaderActionContext, number> = {
  dm: 2,
  group: 2,
};
const HEADER_MENU_WIDTH = 268;
const HEADER_MENU_ESTIMATED_HEIGHT = 420;
const HEADER_MENU_VIEWPORT_PADDING = 12;
const HEADER_MENU_GAP = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHeaderActionId(value: unknown): value is HeaderActionId {
  return typeof value === 'string' && HEADER_ACTION_ID_SET.has(value);
}

function normalizeQuickActionIds(value: unknown): HeaderActionId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isHeaderActionId);
}

function readQuickActionPreferences(): QuickActionPreferences {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const rawValue = window.localStorage.getItem(QUICK_ACTION_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!isRecord(parsedValue)) {
      return {};
    }

    return HEADER_ACTION_CONTEXTS.reduce<QuickActionPreferences>((preferences, context) => {
      const actionIds = normalizeQuickActionIds(parsedValue[context]);
      if (actionIds.length > 0 || Array.isArray(parsedValue[context])) {
        preferences[context] = actionIds;
      }
      return preferences;
    }, {});
  } catch {
    return {};
  }
}

function writeQuickActionPreferences(preferences: QuickActionPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(QUICK_ACTION_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage failures so chat actions remain usable.
  }
}

function resolveActionContext(conversationType?: ConversationType): HeaderActionContext {
  return conversationType === 'group' ? 'group' : 'dm';
}

function getHeaderMenuStyle(anchorRect: HeaderMenuRect) {
  if (typeof window === 'undefined') {
    return {};
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const isMobile = viewportWidth < 768;

  if (isMobile) {
    return {
      width: `min(${HEADER_MENU_WIDTH}px, calc(100vw - ${HEADER_MENU_VIEWPORT_PADDING * 2}px))`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      maxHeight: `calc(100vh - ${HEADER_MENU_VIEWPORT_PADDING * 2}px)`,
    } as const;
  }

  const preferredLeft = anchorRect.right - HEADER_MENU_WIDTH;
  const left = Math.min(
    Math.max(HEADER_MENU_VIEWPORT_PADDING, preferredLeft),
    viewportWidth - HEADER_MENU_WIDTH - HEADER_MENU_VIEWPORT_PADDING
  );
  const hasRoomBelow =
    anchorRect.bottom + HEADER_MENU_GAP + HEADER_MENU_ESTIMATED_HEIGHT <=
    viewportHeight - HEADER_MENU_VIEWPORT_PADDING;
  const top = hasRoomBelow
    ? anchorRect.bottom + HEADER_MENU_GAP
    : Math.max(
        HEADER_MENU_VIEWPORT_PADDING,
        anchorRect.top - HEADER_MENU_GAP - HEADER_MENU_ESTIMATED_HEIGHT
      );

  return {
    width: HEADER_MENU_WIDTH,
    left,
    top,
    maxHeight: `calc(100vh - ${HEADER_MENU_VIEWPORT_PADDING * 2}px)`,
  } as const;
}

function resolveQuickActions(
  context: HeaderActionContext,
  preferences: QuickActionPreferences,
  actions: HeaderAction[]
) {
  const availableActionIds = new Set(actions.map((action) => action.id));
  const configuredActionIds = preferences[context] ?? DEFAULT_QUICK_ACTIONS[context];
  const maxQuickActions = MAX_QUICK_ACTIONS[context];
  const quickActionIds = configuredActionIds
    .filter((actionId) => availableActionIds.has(actionId))
    .filter((actionId, index, actionIds) => actionIds.indexOf(actionId) === index)
    .slice(0, maxQuickActions);

  return quickActionIds
    .map((actionId) => actions.find((action) => action.id === actionId))
    .filter((action): action is HeaderAction => !!action);
}

function HeaderActionIcon({ action }: { action: HeaderAction }) {
  const Icon = action.icon;

  return <Icon className={cn('h-4 w-4', action.iconClassName)} />;
}

interface HeaderActionsMenuProps {
  actions: HeaderAction[];
  anchorRect: HeaderMenuRect | null;
  quickActionIds: readonly HeaderActionId[];
  onOpenChange: (open: boolean) => void;
  onToggleQuickAction: (actionId: HeaderActionId) => void;
}

function HeaderActionsMenu({
  actions,
  anchorRect,
  quickActionIds,
  onOpenChange,
  onToggleQuickAction,
}: HeaderActionsMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!anchorRect) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLButtonElement>('button:not(:disabled)')
        ?.focus();
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    const closeMenu = () => onOpenChange(false);

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [anchorRect, onOpenChange]);

  const menuStyle = useMemo(
    () => (anchorRect ? getHeaderMenuStyle(anchorRect) : {}),
    [anchorRect]
  );

  if (!anchorRect || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-transparent" onClick={() => onOpenChange(false)} />
      <div
        ref={panelRef}
        role="menu"
        className="absolute overflow-y-auto rounded-2xl border border-border/70 bg-background/98 p-2 shadow-2xl backdrop-blur"
        style={menuStyle}
      >
        {actions.map((action) => {
          const isQuickAction = quickActionIds.includes(action.id);
          const pinLabel = isQuickAction
            ? `Remove ${action.label} from quick actions`
            : `Pin ${action.label} to quick actions`;

          return (
            <div
              key={action.id}
              role="none"
              className="flex items-center gap-1 rounded-xl transition-colors hover:bg-muted/80 focus-within:bg-muted/80"
            >
              <button
                type="button"
                role="menuitem"
                disabled={action.disabled}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  action.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
                onClick={() => {
                  onOpenChange(false);
                  action.onSelect();
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/80">
                  <HeaderActionIcon action={action} />
                </span>
                <span className="min-w-0 truncate">{action.label}</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={isQuickAction}
                title={pinLabel}
                aria-label={pinLabel}
                className={cn(
                  'mr-1 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors',
                  'hover:bg-background hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                )}
                onClick={() => onToggleQuickAction(action.id)}
              >
                {isQuickAction ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

interface ChatHeaderProps {
  selectedUser: string;
  displaySelectedUser?: string | null;
  selectedConversationUserAvatarUrl?: string;
  isTyping: boolean;
  isOnline: boolean;
  presenceState?: PresenceState;
  isGhost?: boolean;
  conversationType?: ConversationType;
  showInvite?: boolean;
  onOpenInvite?: () => void;
  notificationLevel?: NotificationLevel;
  mutedUntil?: string | null;
  isUpdatingNotifications?: boolean;
  onCycleNotificationLevel?: () => void;
  inboxPinned?: boolean;
  inboxArchived?: boolean;
  isUpdatingInboxState?: boolean;
  onToggleInboxPin?: () => void;
  onToggleInboxArchive?: () => void;
  onMoveToFolder?: () => void;
  isPingAccepted: boolean;
  pingStatus: string;
  isSendingPing: boolean;
  canPing: boolean;
  canCall: boolean;
  isCallBusy: boolean;
  onCloseConversation: () => void;
  onOpenProfile: () => void;
  onOpenGroupInfo?: () => void;
  onOpenSearch?: () => void;
  onOpenScheduled?: () => void;
  onOpenSaved?: () => void;
  onSendPing: () => void;
  onStartAudioCall: () => void;
  onStartVideoCall: () => void;
}

export function ChatHeader({
  selectedUser,
  displaySelectedUser,
  selectedConversationUserAvatarUrl,
  isTyping,
  isOnline,
  presenceState = isOnline ? 'online' : 'offline',
  isGhost = false,
  conversationType = 'dm',
  showInvite = false,
  onOpenInvite,
  notificationLevel = 'all',
  mutedUntil = null,
  isUpdatingNotifications = false,
  onCycleNotificationLevel,
  inboxPinned = false,
  inboxArchived = false,
  isUpdatingInboxState = false,
  onToggleInboxPin,
  onToggleInboxArchive,
  onMoveToFolder,
  isPingAccepted,
  pingStatus,
  isSendingPing,
  canPing,
  canCall,
  isCallBusy,
  onCloseConversation,
  onOpenProfile,
  onOpenGroupInfo,
  onOpenSearch,
  onOpenScheduled,
  onOpenSaved,
  onSendPing,
  onStartAudioCall,
  onStartVideoCall,
}: ChatHeaderProps) {
  const [menuAnchorRect, setMenuAnchorRect] = useState<HeaderMenuRect | null>(null);
  const [quickActionPreferences, setQuickActionPreferences] = useState<QuickActionPreferences>(
    readQuickActionPreferences
  );
  const actionContext = resolveActionContext(conversationType);
  const isGroup = conversationType === 'group';
  const isDirectMessage = conversationType === 'dm';
  const presenceLabel =
    presenceState === 'dnd'
      ? 'Do not disturb'
      : presenceState === 'away'
        ? 'Away'
        : isOnline
          ? 'Online'
          : 'Offline';
  const isMuted =
    notificationLevel === 'none' ||
    (mutedUntil ? new Date(mutedUntil).getTime() > Date.now() : false);
  const notificationTitle = isMuted
    ? 'Enable all notifications'
    : notificationLevel === 'all'
      ? 'Switch to mentions only'
      : 'Mute for 8 hours';
  const pingTitle =
    pingStatus === 'outgoing_pending'
      ? 'Ping request pending'
      : pingStatus === 'incoming_pending'
        ? 'Ping request received'
        : 'Send ping';
  const actions = useMemo<HeaderAction[]>(() => {
    const nextActions: HeaderAction[] = [];

    if (isDirectMessage && isPingAccepted) {
      nextActions.push(
        {
          id: 'audio_call',
          label: 'Audio call',
          title: 'Start audio call',
          icon: Phone,
          disabled: !canCall || isCallBusy,
          onSelect: onStartAudioCall,
        },
        {
          id: 'video_call',
          label: 'Video call',
          title: 'Start video call',
          icon: Video,
          disabled: !canCall || isCallBusy,
          onSelect: onStartVideoCall,
        }
      );
    }

    if (isDirectMessage && !isPingAccepted) {
      nextActions.push({
        id: 'send_ping',
        label: pingTitle,
        title: pingTitle,
        icon:
          isSendingPing
            ? Loader2
            : pingStatus === 'incoming_pending'
              ? Bell
              : pingStatus === 'outgoing_pending'
                ? Clock
                : UserPlus,
        iconClassName: isSendingPing ? 'animate-spin' : undefined,
        disabled:
          isSendingPing ||
          !canPing ||
          pingStatus === 'outgoing_pending' ||
          pingStatus === 'incoming_pending',
        onSelect: onSendPing,
      });
    }

    if (showInvite && onOpenInvite) {
      nextActions.push({
        id: 'invite',
        label: 'Invite people',
        title: 'Invite people',
        icon: UserPlus,
        onSelect: onOpenInvite,
      });
    }

    if (onOpenSearch) {
      nextActions.push({
        id: 'search',
        label: 'Search messages',
        title: 'Search messages',
        icon: Search,
        onSelect: onOpenSearch,
      });
    }

    if (onOpenSaved) {
      nextActions.push({
        id: 'saved',
        label: 'Saved messages',
        title: 'Saved messages',
        icon: Bookmark,
        onSelect: onOpenSaved,
      });
    }

    if (onOpenScheduled) {
      nextActions.push({
        id: 'scheduled',
        label: 'Scheduled messages',
        title: 'Scheduled messages',
        icon: Clock,
        onSelect: onOpenScheduled,
      });
    }

    if (isPingAccepted && onCycleNotificationLevel) {
      nextActions.push({
        id: 'notifications',
        label: notificationTitle,
        title: notificationTitle,
        icon: isUpdatingNotifications ? Loader2 : isMuted ? BellOff : Bell,
        iconClassName: isUpdatingNotifications ? 'animate-spin' : undefined,
        disabled: isUpdatingNotifications,
        onSelect: onCycleNotificationLevel,
      });
    }

    if (isPingAccepted && onToggleInboxPin) {
      nextActions.push({
        id: 'chat_pin',
        label: inboxPinned ? 'Unpin chat' : 'Pin chat',
        title: inboxPinned ? 'Unpin chat' : 'Pin chat',
        icon: inboxPinned ? PinOff : Pin,
        disabled: isUpdatingInboxState,
        onSelect: onToggleInboxPin,
      });
    }

    if (isPingAccepted && onMoveToFolder) {
      nextActions.push({
        id: 'folder',
        label: 'Move to folder',
        title: 'Move to folder',
        icon: FolderInput,
        disabled: isUpdatingInboxState,
        onSelect: onMoveToFolder,
      });
    }

    if (isPingAccepted && onToggleInboxArchive) {
      nextActions.push({
        id: 'archive',
        label: inboxArchived ? 'Unarchive chat' : 'Archive chat',
        title: inboxArchived ? 'Unarchive chat' : 'Archive chat',
        icon: inboxArchived ? ArchiveRestore : Archive,
        disabled: isUpdatingInboxState,
        onSelect: onToggleInboxArchive,
      });
    }

    return nextActions;
  }, [
    canCall,
    canPing,
    inboxArchived,
    inboxPinned,
    isCallBusy,
    isDirectMessage,
    isMuted,
    isPingAccepted,
    isSendingPing,
    isUpdatingInboxState,
    isUpdatingNotifications,
    notificationTitle,
    onCycleNotificationLevel,
    onMoveToFolder,
    onOpenInvite,
    onOpenSaved,
    onOpenScheduled,
    onOpenSearch,
    onSendPing,
    onStartAudioCall,
    onStartVideoCall,
    onToggleInboxArchive,
    onToggleInboxPin,
    pingStatus,
    pingTitle,
    showInvite,
  ]);
  const quickActions = useMemo(
    () => resolveQuickActions(actionContext, quickActionPreferences, actions),
    [actionContext, actions, quickActionPreferences]
  );
  const quickActionIds = quickActions.map((action) => action.id);

  useEffect(() => {
    writeQuickActionPreferences(quickActionPreferences);
  }, [quickActionPreferences]);

  const toggleQuickAction = (actionId: HeaderActionId) => {
    setQuickActionPreferences((currentPreferences) => {
      const currentActionIds =
        currentPreferences[actionContext] ?? DEFAULT_QUICK_ACTIONS[actionContext];
      const nextActionIds = currentActionIds.includes(actionId)
        ? currentActionIds.filter((currentActionId) => currentActionId !== actionId)
        : [actionId, ...currentActionIds.filter((currentActionId) => currentActionId !== actionId)];

      return {
        ...currentPreferences,
        [actionContext]: nextActionIds.slice(0, MAX_QUICK_ACTIONS[actionContext]),
      };
    });
  };

  const toggleMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (menuAnchorRect) {
      setMenuAnchorRect(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setMenuAnchorRect({
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
    });
  };

  return (
    <div className="h-16 border-b flex items-center px-4 justify-between bg-background/95 backdrop-blur z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -ml-2 h-11 w-11 rounded-full"
          onClick={onCloseConversation}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <Logo variant="symbol" size="sm" className="md:hidden" aria-label="Vogi" />
        <ProfileTriggerButton
          title={displaySelectedUser}
          subtitle={
            isTyping ? (
              <span className="text-primary font-medium animate-pulse">Typing...</span>
            ) : isGhost ? (
              'Reconnect required'
            ) : (
              presenceLabel
            )
          }
          avatarUrl={selectedConversationUserAvatarUrl}
          fallback={(displaySelectedUser || '?')[0].toUpperCase()}
          onClick={isGroup ? onOpenGroupInfo : onOpenProfile}
          disabled={isGroup ? false : !selectedUser || isGhost}
          online={!isGroup && !isGhost && isOnline}
          presenceState={!isGroup && !isGhost ? presenceState : 'offline'}
          avatarClassName="h-9 w-9 border"
          className="max-w-full"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {quickActions.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={action.onSelect}
            disabled={action.disabled}
            title={action.title}
            aria-label={action.title}
          >
            <HeaderActionIcon action={action} />
          </Button>
        ))}
        {actions.length > 0 ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={toggleMenu}
              title="Chat actions"
              aria-label="Chat actions"
              aria-haspopup="menu"
              aria-expanded={!!menuAnchorRect}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            <HeaderActionsMenu
              actions={actions}
              anchorRect={menuAnchorRect}
              quickActionIds={quickActionIds}
              onOpenChange={(open) => {
                if (!open) {
                  setMenuAnchorRect(null);
                }
              }}
              onToggleQuickAction={toggleQuickAction}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
