import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Pin, X } from 'lucide-react';
import { toast } from 'sonner';

import { messagesApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { MessageDoc } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { cn } from '@/lib/utils';

interface PinnedMessagesBarProps {
  conversationId: string;
  /** The conversation's pinned message ids (from the conversation view). */
  pinnedMessageIds: readonly string[];
  /** Whether the viewer may unpin (owner/admin). */
  canManagePins: boolean;
  /** Optional jump-to-message handler; the row is a button only when provided. */
  onSelectMessage?: (messageId: string) => void;
}

const pinnedKey = (conversationId: string) => ['pinned-messages', conversationId] as const;

function previewText(message: MessageDoc): string {
  const resolved = resolveMessageContent(message);
  if (resolved.isEncrypted) return 'Encrypted message';
  if (resolved.text && resolved.text.trim()) return resolved.text.trim();
  if (resolved.media) return `${resolved.media.kind} attachment`;
  if (resolved.call) return `${resolved.call.type} call`;
  return 'Message';
}

export function PinnedMessagesBar({
  conversationId,
  pinnedMessageIds,
  canManagePins,
  onSelectMessage,
}: PinnedMessagesBarProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const pinnedQuery = useQuery({
    // Keyed on the id set so a pin/unpin elsewhere refetches the previews.
    queryKey: [...pinnedKey(conversationId), pinnedMessageIds.join(',')],
    queryFn: () => messagesApi.getPinnedMessages(conversationId),
    enabled: pinnedMessageIds.length > 0,
  });

  const messages = useMemo<MessageDoc[]>(
    () => pinnedQuery.data ?? [],
    [pinnedQuery.data]
  );

  const unpinMutation = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.unpinMessage(conversationId, messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pinnedKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Could not unpin message'));
    },
  });

  if (pinnedMessageIds.length === 0) {
    return null;
  }

  const count = pinnedMessageIds.length;
  const collapsedPreview = messages[0] ? previewText(messages[0]) : null;

  return (
    <div className="border-b border-border/70 bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-muted/50"
      >
        <Pin className="h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">
            {count} pinned {count === 1 ? 'message' : 'messages'}
          </div>
          {!expanded && collapsedPreview ? (
            <div className="truncate text-xs text-muted-foreground">{collapsedPreview}</div>
          ) : null}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto px-2 pb-2">
          {messages.map((message) => {
            const text = previewText(message);
            return (
              <li
                key={message.id}
                className="flex items-center gap-2 rounded-xl bg-background/60 px-2 py-1.5"
              >
                <button
                  type="button"
                  disabled={!onSelectMessage}
                  onClick={() => onSelectMessage?.(message.id)}
                  className={cn(
                    'min-w-0 flex-1 truncate text-left text-sm text-foreground',
                    onSelectMessage ? 'hover:underline' : 'cursor-default'
                  )}
                >
                  {text}
                </button>
                {canManagePins ? (
                  <button
                    type="button"
                    aria-label="Unpin message"
                    disabled={unpinMutation.isPending}
                    onClick={() => unpinMutation.mutate(message.id)}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </li>
            );
          })}
          {messages.length === 0 && pinnedQuery.isLoading ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">Loading…</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
