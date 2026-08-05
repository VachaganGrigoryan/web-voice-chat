import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { useContainer, useContainerCompose } from '@/container';
import { useAuthStore } from '@/store/authStore';
import { useContacts } from '@/hooks/useContacts';
import ChatComposer from '@/features/chat/composer';

interface AddPostModalProps {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Composing a post is composing a message with different chrome, so this is a
 * modal around `ChatComposer` in its `post-box` preset rather than a second
 * composer. Attachments, polls, locations, contacts, emoji, upload progress and
 * cancellation all come from the same implementation the chat lens uses — the
 * duplication that produced the old text-only post box is gone.
 */
export function AddPostModal({ channelId, open, onOpenChange }: AddPostModalProps) {
  const currentUserId = useAuthStore((state) => state.userId);
  const ref = useMemo(
    () => ({ container_type: 'channel', container_id: channelId }) as const,
    [channelId]
  );
  const { descriptor } = useContainer(ref, currentUserId, { lens: 'feed' });
  const compose = useContainerCompose(descriptor);
  const { contacts } = useContacts();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create a post</DialogTitle>
          <DialogDescription>
            {descriptor ? `Posting to ${descriptor.identity.title}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {descriptor ? (
          <ChatComposer
            container={descriptor.ref}
            preset="post-box"
            submitLabel="Post"
            onSendText={compose.sendText}
            onSendMedia={compose.sendMedia}
            onSendRichContent={compose.sendRichContent}
            onCreatePoll={compose.createPoll}
            contacts={contacts}
            isUploading={compose.isSending}
            contextLabel="post"
            onSent={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
