import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { ChatMessage } from '../types/message';

interface MessageActionsDialogProps {
  open: boolean;
  message: ChatMessage | null;
  onOpenChange: (open: boolean) => void;
  onReply: () => void;
  onThread: () => void;
  onEdit: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isEditing: boolean;
  isDeleting: boolean;
}

type DialogView = 'actions' | 'edit' | 'info';

const formatDateTime = (value?: string) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const getMessagePreview = (message: ChatMessage) => {
  if (message.isDeleted) return 'Message deleted';
  if (message.kind === 'text' || message.kind === 'emoji') return message.text;
  if (message.kind === 'image' || message.kind === 'video') return message.caption || `${message.kind} message`;
  if (message.kind === 'audio') return 'Voice message';
  if (message.kind === 'sticker') return 'Sticker';
  if (message.kind === 'system') return message.text;
  return 'Message';
};

export function MessageActionsDialog({
  open,
  message,
  onOpenChange,
  onReply,
  onThread,
  onEdit,
  onDelete,
  isEditing,
  isDeleting,
}: MessageActionsDialogProps) {
  const [view, setView] = useState<DialogView>('actions');
  const [draftText, setDraftText] = useState('');

  useEffect(() => {
    if (!open) {
      setView('actions');
      return;
    }

    setDraftText(message?.kind === 'text' ? message.text : '');
  }, [message, open]);

  const canEdit = !!message && message.isOwn && message.kind === 'text' && !message.isDeleted;
  const canDelete = !!message && message.isOwn && !message.isDeleted;
  const preview = useMemo(() => (message ? getMessagePreview(message) : ''), [message]);

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {view === 'actions' ? (
          <>
            <DialogHeader>
              <DialogTitle>Message Actions</DialogTitle>
              <DialogDescription className="line-clamp-2 break-words">
                {preview}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <Button variant="outline" className="justify-start" onClick={onReply}>
                Reply
              </Button>
              <Button variant="outline" className="justify-start" onClick={onThread}>
                Open Thread
              </Button>
              {canEdit ? (
                <Button variant="outline" className="justify-start" onClick={() => setView('edit')}>
                  Edit
                </Button>
              ) : null}
              <Button variant="outline" className="justify-start" onClick={() => setView('info')}>
                Info
              </Button>
              {canDelete ? (
                <Button variant="destructive" className="justify-start" onClick={() => void onDelete()}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {view === 'edit' ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit Message</DialogTitle>
              <DialogDescription>Only text messages can be edited.</DialogDescription>
            </DialogHeader>

            <textarea
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Update message text"
            />

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setView('actions')}>
                Back
              </Button>
              <Button
                onClick={() => void onEdit(draftText.trim())}
                disabled={!draftText.trim() || isEditing}
              >
                {isEditing ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </>
        ) : null}

        {view === 'info' ? (
          <>
            <DialogHeader>
              <DialogTitle>Message Info</DialogTitle>
              <DialogDescription>Delivery and metadata details.</DialogDescription>
            </DialogHeader>

            <div className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">ID:</span> {message.id}</div>
              <div><span className="text-muted-foreground">Type:</span> {message.kind}</div>
              <div><span className="text-muted-foreground">Status:</span> {message.status}</div>
              <div><span className="text-muted-foreground">Created:</span> {formatDateTime(message.createdAt)}</div>
              <div><span className="text-muted-foreground">Updated:</span> {formatDateTime(message.updatedAt)}</div>
              <div><span className="text-muted-foreground">Edited:</span> {formatDateTime(message.editedAt)}</div>
              <div><span className="text-muted-foreground">Deleted:</span> {formatDateTime(message.deletedAt)}</div>
              <div><span className="text-muted-foreground">Reply Mode:</span> {message.replyMode || '—'}</div>
              <div><span className="text-muted-foreground">Reply To:</span> {message.replyToMessageId || '—'}</div>
              <div><span className="text-muted-foreground">Thread Root:</span> {message.threadRootId || '—'}</div>
              <div><span className="text-muted-foreground">Thread Replies:</span> {message.threadReplyCount}</div>
              <div><span className="text-muted-foreground">Last Thread Reply:</span> {formatDateTime(message.lastThreadReplyAt)}</div>
              <div><span className="text-muted-foreground">Reactions:</span> {message.reactions.length}</div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setView('actions')}>
                Back
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
