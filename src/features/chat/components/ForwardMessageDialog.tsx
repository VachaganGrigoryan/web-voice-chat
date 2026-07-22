import { useMemo, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

import { messagesApi } from '@/api/endpoints';
import type { Conversation } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversations: Conversation[];
  sourceConversationId: string | null;
  messageId: string | null;
  onForwarded?: (targetConversationId: string) => void;
}

function conversationLabel(conversation: Conversation): string {
  if (conversation.type === 'group') return conversation.title || 'Group chat';
  if (conversation.type === 'channel') return conversation.title || 'Channel';
  if (conversation.type === 'thread') return conversation.title || 'Thread';
  const peer = conversation.peer_user;
  if (!peer) return 'Conversation';
  return peer.display_name || peer.username || peer.id;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  conversations,
  sourceConversationId,
  messageId,
  onForwarded,
}: ForwardMessageDialogProps) {
  const [filter, setFilter] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const targets = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    return conversations
      .filter((conversation) => conversation.id !== sourceConversationId)
      .filter((conversation) =>
        normalized ? conversationLabel(conversation).toLowerCase().includes(normalized) : true
      );
  }, [conversations, filter, sourceConversationId]);

  const forward = async (targetConversationId: string) => {
    if (!sourceConversationId || !messageId || pendingId) return;
    setPendingId(targetConversationId);
    try {
      await messagesApi.forwardMessage(sourceConversationId, messageId, targetConversationId);
      toast.success('Message forwarded');
      onForwarded?.(targetConversationId);
      onOpenChange(false);
      setFilter('');
    } catch (error) {
      toast.error(extractApiError(error, 'Could not forward message'));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Forward message</DialogTitle>
          <DialogDescription>Choose a conversation to forward to.</DialogDescription>
        </DialogHeader>

        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search conversations"
          autoFocus
        />

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {targets.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No conversations to forward to.
            </p>
          ) : (
            <ul className="space-y-1">
              {targets.map((conversation) => {
                const isPending = pendingId === conversation.id;
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      disabled={!!pendingId}
                      onClick={() => void forward(conversation.id)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/70',
                        !!pendingId && 'opacity-60'
                      )}
                    >
                      <span className="truncate text-foreground">
                        {conversationLabel(conversation)}
                      </span>
                      {isPending ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      ) : (
                        <Send className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
