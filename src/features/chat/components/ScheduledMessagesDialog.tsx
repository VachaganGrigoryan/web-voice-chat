import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import { messagesApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { MessageContainerRef, MessageDoc } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { formatMessageDateTime, getBrowserTimeZone } from '@/utils/dateUtils';

interface ScheduledMessagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  container: MessageContainerRef;
}

const scheduledKey = (container: MessageContainerRef) =>
  ['scheduled-messages', container.container_type, container.container_id] as const;

/** Minimum `datetime-local` value: one minute from now, in the user's timezone. */
function minLocalDateTime(): string {
  const now = new Date(Date.now() + 60_000);
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function ScheduledMessagesDialog({
  open,
  onOpenChange,
  container,
}: ScheduledMessagesDialogProps) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [when, setWhen] = useState('');

  const scheduledQuery = useQuery({
    queryKey: scheduledKey(container),
    queryFn: () => messagesApi.getScheduledMessages(container),
    enabled: open,
  });

  const scheduled = useMemo<MessageDoc[]>(
    () => scheduledQuery.data ?? [],
    [scheduledQuery.data]
  );

  const scheduleMutation = useMutation({
    mutationFn: () => {
      const iso = new Date(when).toISOString();
      return messagesApi.scheduleMessage(container, text.trim(), iso);
    },
    onSuccess: () => {
      setText('');
      setWhen('');
      queryClient.invalidateQueries({ queryKey: scheduledKey(container) });
      toast.success('Message scheduled');
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Could not schedule message'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (messageId: string) =>
      messagesApi.cancelScheduledMessage(messageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduledKey(container) });
    },
    onError: (error) => {
      toast.error(extractApiError(error, 'Could not cancel message'));
    },
  });

  const whenIsFuture = !!when && new Date(when).getTime() > Date.now();
  const canSchedule = !!text.trim() && whenIsFuture && !scheduleMutation.isPending;

  // `when` is a local `datetime-local` value; `new Date(when)` resolves it in the
  // user's zone, so this confirmation reflects exactly when the message fires.
  const sendConfirmation = whenIsFuture
    ? `Sends at ${formatMessageDateTime(new Date(when).toISOString())} (${getBrowserTimeZone()})`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Scheduled messages</DialogTitle>
          <DialogDescription>
            Compose a message to send later, and manage pending ones.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSchedule) scheduleMutation.mutate();
          }}
        >
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Write your message…"
            className="min-h-20 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={when}
              min={minLocalDateTime()}
              onChange={(event) => setWhen(event.target.value)}
              className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="submit" disabled={!canSchedule}>
              {scheduleMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Schedule'
              )}
            </Button>
          </div>
          {sendConfirmation ? (
            <p className="text-xs text-muted-foreground">{sendConfirmation}</p>
          ) : null}
        </form>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-border/70 pt-3">
          {scheduled.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No scheduled messages.
            </p>
          ) : (
            <ul className="space-y-1">
              {scheduled.map((message) => (
                <li
                  key={message.id}
                  className="flex items-center gap-2 rounded-xl bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-foreground">
                      {resolveMessageContent(message).text || 'Message'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {message.scheduled_for
                        ? formatMessageDateTime(message.scheduled_for) || ''
                        : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Cancel scheduled message"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(message.id)}
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
