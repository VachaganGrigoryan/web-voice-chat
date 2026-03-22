import React from 'react';
import {
  ArrowLeft,
  Bell,
  Clock,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import MediaComposer from '../media/upload/MediaComposer';
import { ProfileTriggerButton } from './ProfileTriggerButton';
import { ComposerReplyTarget } from '../types/message';

interface ChatHeaderProps {
  selectedUser: string;
  displaySelectedUser?: string | null;
  selectedConversationUserAvatarUrl?: string;
  isTyping: boolean;
  isOnline: boolean;
  isPingAccepted: boolean;
  isUploading: boolean;
  replyTarget: ComposerReplyTarget | null;
  pingStatus: string;
  isSendingPing: boolean;
  canPing: boolean;
  onCloseConversation: () => void;
  onOpenProfile: () => void;
  onSendMedia: (data: {
    type: 'voice' | 'image' | 'sticker' | 'video' | 'file';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
    client_batch_id?: string;
    signal?: AbortSignal;
    onUploadProgress?: (progress: number) => void;
  }) => Promise<unknown>;
  onClearReplyTarget: () => void;
  onSendPing: () => void;
}

export function ChatHeader({
  selectedUser,
  displaySelectedUser,
  selectedConversationUserAvatarUrl,
  isTyping,
  isOnline,
  isPingAccepted,
  isUploading,
  replyTarget,
  pingStatus,
  isSendingPing,
  canPing,
  onCloseConversation,
  onOpenProfile,
  onSendMedia,
  onClearReplyTarget,
  onSendPing,
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
            ) : isOnline ? (
              'Online'
            ) : (
              'Offline'
            )
          }
          avatarUrl={selectedConversationUserAvatarUrl}
          fallback={(displaySelectedUser || '?')[0].toUpperCase()}
          onClick={onOpenProfile}
          disabled={!selectedUser}
          online={isOnline}
          avatarClassName="h-9 w-9 border"
          className="max-w-full"
        />
      </div>

      <div className="flex items-center">
        {isPingAccepted ? (
          <MediaComposer
            receiverId={selectedUser}
            onSendMedia={onSendMedia}
            isUploading={isUploading}
            replyTarget={replyTarget}
            onClearReplyTarget={onClearReplyTarget}
          />
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
