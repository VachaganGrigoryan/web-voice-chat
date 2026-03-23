import { type MouseEvent as ReactMouseEvent } from 'react';
import { Bell, LogOut, MoreVertical } from 'lucide-react';
import { Conversation, User } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { ProfileTriggerButton } from '@/features/chat/components/ProfileTriggerButton';
import { UserSearch } from '@/features/discovery/UserSearch';
import { cn } from '@/lib/utils';
import { formatMessageDay, formatMessageTime, isSameLocalDay } from '@/utils/dateUtils';

interface ChatSidebarProps {
  profile: User | null | undefined;
  userEmail: string | null;
  currentUserId: string | null;
  pendingIncomingCount: number;
  contacts: Conversation[];
  selectedUser: string | null;
  typingUsers: Record<string, boolean>;
  activeConversationMenuPeerUserId: string | null;
  onOpenSettings: () => void;
  onOpenPings: () => void;
  onLogout: () => void;
  onSelectSearchUser: (peerUserId: string) => void;
  onSelectConversation: (peerUserId: string) => void;
  onOpenConversationMenu: (event: ReactMouseEvent<HTMLElement>, peerUserId: string, unreadCount: number) => void;
  onOpenConversationMenuAtPoint: (event: ReactMouseEvent<HTMLElement>, peerUserId: string, unreadCount: number) => void;
}

function formatConversationTimestamp(value: string | null) {
  if (!value) {
    return '';
  }

  return isSameLocalDay(value, new Date()) ? formatMessageTime(value) : formatMessageDay(value);
}

function ConversationListItem({
  conversation,
  isSelected,
  isCurrentUserConversation,
  isTyping,
  isMenuOpen,
  onSelect,
  onOpenMenu,
  onOpenMenuAtPoint,
}: {
  conversation: Conversation;
  isSelected: boolean;
  isCurrentUserConversation: boolean;
  isTyping: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        isSelected
          ? 'border-primary/20 bg-background/95 shadow-sm ring-1 ring-primary/10'
          : 'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm',
        isCurrentUserConversation && 'pointer-events-none opacity-50'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenuAtPoint(event);
      }}
    >
      <button
        type="button"
        className="flex w-full min-w-0 max-w-full items-center gap-3 rounded-[18px] px-2.5 py-2 pr-12 text-left transition-colors"
        onClick={onSelect}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {conversation.peer_user.avatar ? <AvatarImage src={conversation.peer_user.avatar.url} /> : null}
            <AvatarFallback>
              {(conversation.peer_user.display_name || conversation.peer_user.username || conversation.peer_user.id)[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {conversation.peer_user.is_online ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span
              className={cn(
                'truncate pr-1 text-left text-sm',
                conversation.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'
              )}
            >
              {conversation.peer_user.display_name || conversation.peer_user.username || conversation.peer_user.id}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatConversationTimestamp(conversation.last_message_at)}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-left text-xs',
                conversation.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {isTyping ? (
                <span className="animate-pulse font-medium text-primary">Typing...</span>
              ) : conversation.last_message?.type === 'voice' ? (
                '🎤 Voice message'
              ) : conversation.last_message?.type === 'file' ? (
                '📎 File'
              ) : (
                conversation.last_message?.text || 'Click to chat'
              )}
            </span>
            {conversation.unread_count > 0 ? (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          isMenuOpen && 'bg-muted text-foreground opacity-100'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(event);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ChatSidebar({
  profile,
  userEmail,
  currentUserId,
  pendingIncomingCount,
  contacts,
  selectedUser,
  typingUsers,
  activeConversationMenuPeerUserId,
  onOpenSettings,
  onOpenPings,
  onLogout,
  onSelectSearchUser,
  onSelectConversation,
  onOpenConversationMenu,
  onOpenConversationMenuAtPoint,
}: ChatSidebarProps) {
  return (
    <div
      className={cn(
        'h-full min-h-0 w-full border-r bg-muted/10 md:w-80',
        selectedUser ? 'hidden md:flex' : 'flex'
      )}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b p-4">
          <ProfileTriggerButton
            title={profile?.display_name || profile?.username || userEmail}
            subtitle={profile?.username ? `@${profile.username}` : undefined}
            avatarUrl={profile?.avatar?.url}
            fallback={(profile?.display_name || profile?.username || userEmail || '?')[0].toUpperCase()}
            onClick={onOpenSettings}
            className="max-w-[60%]"
          />
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onOpenPings} className="relative">
              <Bell className="h-4 w-4" />
              {pendingIncomingCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
              ) : null}
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 px-4 pt-4">
            <UserSearch onSelectUser={onSelectSearchUser} />

            <div className="mb-2 flex items-center justify-between px-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Chats</span>
              {contacts.length > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {contacts.length}
                </span>
              ) : null}
            </div>
          </div>

          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            <div className="space-y-2 pb-4 pr-1">
              {contacts.map((conversation) => (
                <ConversationListItem
                  key={conversation.conversation_id}
                  conversation={conversation}
                  isSelected={selectedUser === conversation.peer_user.id}
                  isCurrentUserConversation={conversation.peer_user.id === currentUserId}
                  isTyping={!!typingUsers[conversation.peer_user.id]}
                  isMenuOpen={activeConversationMenuPeerUserId === conversation.peer_user.id}
                  onSelect={() => onSelectConversation(conversation.peer_user.id)}
                  onOpenMenu={(event) => onOpenConversationMenu(event, conversation.peer_user.id, conversation.unread_count ?? 0)}
                  onOpenMenuAtPoint={(event) =>
                    onOpenConversationMenuAtPoint(event, conversation.peer_user.id, conversation.unread_count ?? 0)
                  }
                />
              ))}

              {contacts.length === 0 ? (
                <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                  No recent conversations
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
