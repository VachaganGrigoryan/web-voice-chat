import React from 'react';
import {
  ArrowLeft,
  Bell,
  Clock,
  Loader2,
  Phone,
  UserPlus,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ProfileTriggerButton } from './ProfileTriggerButton';

interface ChatHeaderProps {
  selectedUser: string;
  displaySelectedUser?: string | null;
  selectedConversationUserAvatarUrl?: string;
  isTyping: boolean;
  isOnline: boolean;
  isGhost?: boolean;
  isPingAccepted: boolean;
  pingStatus: string;
  isSendingPing: boolean;
  canPing: boolean;
  canCall: boolean;
  isCallBusy: boolean;
  onCloseConversation: () => void;
  onOpenProfile: () => void;
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
  isGhost = false,
  isPingAccepted,
  pingStatus,
  isSendingPing,
  canPing,
  canCall,
  isCallBusy,
  onCloseConversation,
  onOpenProfile,
  onSendPing,
  onStartAudioCall,
  onStartVideoCall,
}: ChatHeaderProps) {
  return (
    <div className="h-16 border-b flex items-center px-4 justify-between bg-background/95 backdrop-blur z-10 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -ml-2 h-10 w-10 rounded-full"
          onClick={onCloseConversation}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ProfileTriggerButton
          title={displaySelectedUser}
          subtitle={
            isTyping ? (
              <span className="text-primary font-medium animate-pulse">Typing...</span>
            ) : isGhost ? (
              'Reconnect required'
            ) : isOnline ? (
              'Online'
            ) : (
              'Offline'
            )
          }
          avatarUrl={selectedConversationUserAvatarUrl}
          fallback={(displaySelectedUser || '?')[0].toUpperCase()}
          onClick={onOpenProfile}
          disabled={!selectedUser || isGhost}
          online={!isGhost && isOnline}
          avatarClassName="h-9 w-9 border"
          className="max-w-full"
        />
      </div>

      <div className="flex items-center">
        {isPingAccepted ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
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
              className="h-10 w-10 rounded-full"
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
