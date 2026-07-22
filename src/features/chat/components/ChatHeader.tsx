import React from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Bookmark,
  Clock,
  Loader2,
  Phone,
  Search,
  UserPlus,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/shared/branding/Logo';
import { ProfileTriggerButton } from './ProfileTriggerButton';
import { PresenceState } from '@/api/types';
import { NotificationLevel } from '@/api/types';

interface ChatHeaderProps {
  selectedUser: string;
  displaySelectedUser?: string | null;
  selectedConversationUserAvatarUrl?: string;
  isTyping: boolean;
  isOnline: boolean;
  presenceState?: PresenceState;
  isGhost?: boolean;
  isGroup?: boolean;
  showInvite?: boolean;
  onOpenInvite?: () => void;
  notificationLevel?: NotificationLevel;
  mutedUntil?: string | null;
  isUpdatingNotifications?: boolean;
  onCycleNotificationLevel?: () => void;
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
  isGroup = false,
  showInvite = false,
  onOpenInvite,
  notificationLevel = 'all',
  mutedUntil = null,
  isUpdatingNotifications = false,
  onCycleNotificationLevel,
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

      <div className="flex items-center gap-2">
        {onOpenSearch ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onOpenSearch}
            title="Search messages"
            aria-label="Search messages"
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : null}
        {onOpenSaved ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onOpenSaved}
            title="Saved messages"
            aria-label="Saved messages"
          >
            <Bookmark className="h-4 w-4" />
          </Button>
        ) : null}
        {onOpenScheduled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onOpenScheduled}
            title="Scheduled messages"
            aria-label="Scheduled messages"
          >
            <Clock className="h-4 w-4" />
          </Button>
        ) : null}
        {showInvite && onOpenInvite ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onOpenInvite}
            title="Invite people"
            aria-label="Invite people"
          >
            <UserPlus className="h-4 w-4" />
          </Button>
        ) : null}
        {isPingAccepted && onCycleNotificationLevel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 rounded-full"
            onClick={onCycleNotificationLevel}
            disabled={isUpdatingNotifications}
            title={notificationTitle}
            aria-label={notificationTitle}
          >
            {isUpdatingNotifications ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isMuted ? (
              <BellOff className="h-4 w-4" />
            ) : (
              <Bell className="h-4 w-4" />
            )}
          </Button>
        ) : null}
        {isGroup ? null : isPingAccepted ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={onStartAudioCall}
              disabled={!canCall || isCallBusy}
              title="Start audio call"
              aria-label="Start audio call"
            >
              <Phone className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={onStartVideoCall}
              disabled={!canCall || isCallBusy}
              title="Start video call"
              aria-label="Start video call"
            >
              <Video className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            onClick={onSendPing}
            disabled={
              isSendingPing ||
              !canPing ||
              pingStatus === 'outgoing_pending' ||
              pingStatus === 'incoming_pending'
            }
            size="sm"
          >
            {pingStatus === 'outgoing_pending' ? (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Pending
              </>
            ) : pingStatus === 'incoming_pending' ? (
              <>
                <Bell className="h-4 w-4 mr-2" />
                Request Received
              </>
            ) : (
              <>
                {isSendingPing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Send Ping
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
