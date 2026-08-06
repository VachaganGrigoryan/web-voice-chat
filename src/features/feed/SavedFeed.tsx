import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { savedMessagesApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { SavedMessageView } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES } from '@/app/routes';
import { formatMessageDateTime } from '@/utils/dateUtils';

const SAVED_KEY = ['saved-messages'] as const;

function savedPreview(saved: SavedMessageView): string {
  if (!saved.message) return 'Message unavailable';
  const resolved = resolveMessageContent(saved.message);
  if (resolved.isEncrypted) return 'Encrypted message';
  if (resolved.text && resolved.text.trim()) return resolved.text.trim();
  if (resolved.media) return `${resolved.media.kind} attachment`;
  return 'Message';
}

export function SavedFeed() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: SAVED_KEY,
    queryFn: () => savedMessagesApi.list(),
  });

  const items = savedQuery.data ?? [];

  const removeMutation = useMutation({
    mutationFn: (messageId: string) => savedMessagesApi.remove(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
      toast.success('Removed from saved');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Could not remove saved message'));
    },
  });

  if (savedQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center text-sm text-muted-foreground">
        Nothing saved yet. Save a message from any conversation to find it here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((saved) => (
        <div
          key={saved.id}
          className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/75 p-4 shadow-e1"
        >
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.chatConversation(saved.conversation_id))}
            className="min-w-0 flex-1 text-left"
          >
            <p className="truncate text-sm text-foreground">{savedPreview(saved)}</p>
            <p className="text-xs text-muted-foreground">
              Saved {formatMessageDateTime(saved.saved_at) || ''}
            </p>
          </button>
          <button
            type="button"
            aria-label="Remove saved message"
            disabled={removeMutation.isPending}
            onClick={() => removeMutation.mutate(saved.message_id)}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
