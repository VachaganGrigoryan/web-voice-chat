import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { savedMessagesApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { SavedMessageView } from '@/api/types';
import { extractApiError } from '@/api/errors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { formatMessageDateTime } from '@/utils/dateUtils';

interface SavedMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSaved?: (saved: SavedMessageView) => void;
}

const SAVED_KEY = ['saved-messages'] as const;

function savedPreview(saved: SavedMessageView): string {
  if (!saved.message) return 'Message unavailable';
  const resolved = resolveMessageContent(saved.message);
  if (resolved.isEncrypted) return 'Encrypted message';
  if (resolved.text && resolved.text.trim()) return resolved.text.trim();
  if (resolved.media) return `${resolved.media.kind} attachment`;
  return 'Message';
}

export function SavedMessagesDialog({
  open,
  onOpenChange,
  onSelectSaved,
}: SavedMessagesDialogProps) {
  const queryClient = useQueryClient();

  const savedQuery = useQuery({
    queryKey: SAVED_KEY,
    queryFn: () => savedMessagesApi.list(),
    enabled: open,
  });

  const items = useMemo<SavedMessageView[]>(
    () => savedQuery.data ?? [],
    [savedQuery.data]
  );

  const removeMutation = useMutation({
    mutationFn: (messageId: string) => savedMessagesApi.remove(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SAVED_KEY });
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Could not remove saved message'));
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Saved messages</DialogTitle>
          <DialogDescription>Your private bookmarks.</DialogDescription>
        </DialogHeader>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {savedQuery.isLoading ? 'Loading…' : 'No saved messages yet.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((saved) => (
                <li
                  key={saved.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2"
                >
                  <button
                    type="button"
                    disabled={!onSelectSaved}
                    onClick={() => onSelectSaved?.(saved)}
                    className="min-w-0 flex-1 text-left disabled:cursor-default"
                  >
                    <div className="truncate text-sm text-foreground">
                      {savedPreview(saved)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Saved {formatMessageDateTime(saved.saved_at) || ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Remove saved message"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(saved.message_id)}
                    className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
