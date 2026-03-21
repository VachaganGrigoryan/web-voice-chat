import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Info, MessageSquareReply, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { formatMessageDateTime } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { ChatMessage } from '../types/message';
import { MessageMenuAnchor } from './MessageShell';

interface MessageActionsDialogProps {
  open: boolean;
  anchor: MessageMenuAnchor | null;
  message: ChatMessage | null;
  onOpenChange: (open: boolean) => void;
  onReply: () => void;
  onThread: () => void;
  onEdit: (text: string) => Promise<void>;
  onDelete: () => Promise<void>;
  isEditing: boolean;
  isDeleting: boolean;
}

type DialogView = 'actions' | 'edit' | 'details';

interface ActionItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

const MENU_WIDTH = 220;
const MOBILE_WIDTH = 320;
const DESKTOP_GAP = 12;
const VIEWPORT_PADDING = 12;

const getCopyText = (message: ChatMessage) => {
  if (message.isDeleted) return '';
  if (message.kind === 'text' || message.kind === 'emoji' || message.kind === 'system') return message.text.trim();
  if (message.kind === 'image' || message.kind === 'video') return (message.caption || '').trim();
  return '';
};

function isMobileLayout(anchor: MessageMenuAnchor | null): boolean {
  if (!anchor || typeof window === 'undefined') {
    return false;
  }

  return anchor.source === 'touch' || window.innerWidth < 768;
}

function getPanelStyle(anchor: MessageMenuAnchor | null, view: DialogView) {
  if (typeof window === 'undefined') {
    return {};
  }

  const mobile = isMobileLayout(anchor);

  if (mobile) {
    return {
      width: `min(${MOBILE_WIDTH}px, calc(100vw - ${VIEWPORT_PADDING * 2}px))`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    } as const;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const referenceRect = anchor?.rect;
  const estimatedHeight = view === 'actions' ? 320 : view === 'edit' ? 340 : 420;

  const preferredLeft = referenceRect
    ? referenceRect.right - MENU_WIDTH
    : (anchor?.x || 0) - MENU_WIDTH / 2;
  let left = Math.min(
    Math.max(VIEWPORT_PADDING, preferredLeft),
    viewportWidth - MENU_WIDTH - VIEWPORT_PADDING
  );

  let top = anchor?.y || VIEWPORT_PADDING;
  if (referenceRect) {
    const hasRoomBelow =
      referenceRect.bottom + DESKTOP_GAP + estimatedHeight <= viewportHeight - VIEWPORT_PADDING;
    top = hasRoomBelow
      ? referenceRect.bottom + DESKTOP_GAP
      : Math.max(VIEWPORT_PADDING, referenceRect.top - DESKTOP_GAP - estimatedHeight);
  }

  top = Math.min(
    Math.max(VIEWPORT_PADDING, top),
    viewportHeight - VIEWPORT_PADDING - estimatedHeight
  );

  left = Number.isFinite(left) ? left : VIEWPORT_PADDING;
  top = Number.isFinite(top) ? top : VIEWPORT_PADDING;

  return {
    width: MENU_WIDTH,
    left,
    top,
  } as const;
}

const ActionButton = ({
  icon,
  label,
  destructive = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors',
      destructive
        ? 'text-destructive hover:bg-destructive/10'
        : 'text-foreground hover:bg-muted/80',
      disabled && 'cursor-not-allowed opacity-50'
    )}
  >
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70">
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </button>
);

export function MessageActionsDialog({
  open,
  anchor,
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
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setView('actions');
      setDraftText('');
      return;
    }

    setView('actions');
    setDraftText(message?.kind === 'text' ? message.text : '');
  }, [message, open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || view === 'details') return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && panelRef.current?.contains(target)) {
        return;
      }

      onOpenChange(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open, onOpenChange, view]);

  const panelStyle = useMemo(() => getPanelStyle(anchor, view), [anchor, view]);
  const copyText = useMemo(() => (message ? getCopyText(message) : ''), [message]);

  const canReply = !!message && message.kind !== 'system' && !message.isDeleted;
  const canThread = canReply;
  const canCopy = !!copyText;
  const canEdit = !!message && message.isOwn && message.kind === 'text' && !message.isDeleted;
  const canDelete = !!message && message.kind !== 'system' && !message.isDeleted;

  const actions = useMemo<ActionItem[]>(() => {
    if (!message) return [];

    const items: ActionItem[] = [];

    if (canCopy) {
      items.push({
        key: 'copy',
        label: 'Copy',
        icon: <Copy className="h-4 w-4" />,
        onSelect: async () => {
          try {
            await navigator.clipboard.writeText(copyText);
            toast.success('Copied');
            onOpenChange(false);
          } catch {
            toast.error('Copy failed');
          }
        },
      });
    }

    if (canReply) {
      items.push({
        key: 'reply',
        label: 'Reply',
        icon: <MessageSquareReply className="h-4 w-4" />,
        onSelect: () => {
          onReply();
          onOpenChange(false);
        },
      });
    }

    if (canThread) {
      items.push({
        key: 'thread',
        label: 'Open Thread',
        icon: <MessageSquareReply className="h-4 w-4" />,
        onSelect: () => {
          onThread();
          onOpenChange(false);
        },
      });
    }

    if (canEdit) {
      items.push({
        key: 'edit',
        label: 'Edit',
        icon: <Pencil className="h-4 w-4" />,
        onSelect: () => setView('edit'),
      });
    }

    items.push({
      key: 'details',
      label: 'Details',
      icon: <Info className="h-4 w-4" />,
      onSelect: () => setView('details'),
    });

    if (canDelete) {
      items.push({
        key: 'delete',
        label: 'Delete',
        icon: <Trash2 className="h-4 w-4" />,
        destructive: true,
        disabled: isDeleting,
        onSelect: async () => {
          await onDelete();
          onOpenChange(false);
        },
      });
    }

    return items;
  }, [canCopy, canDelete, canEdit, canReply, canThread, copyText, isDeleting, message, onDelete, onOpenChange, onReply, onThread]);

  if (!open || !message || typeof document === 'undefined') {
    return null;
  }

  const renderActions = () => (
    <div className="space-y-1 p-2">
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          icon={action.icon}
          label={action.label}
          destructive={action.destructive}
          disabled={action.disabled}
          onClick={() => void action.onSelect()}
        />
      ))}
    </div>
  );

  const renderEdit = () => (
    <div className="space-y-3 p-4">
      <div>
        <div className="text-sm font-semibold text-foreground">Edit Message</div>
        <div className="mt-1 text-xs text-muted-foreground">Only text messages can be edited.</div>
      </div>
      <textarea
        value={draftText}
        onChange={(event) => setDraftText(event.target.value)}
        className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Update message text"
      />
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setView('actions')}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={() => void onEdit(draftText.trim())}
          disabled={!draftText.trim() || isEditing}
        >
          {isEditing ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );

  const renderDetails = () => (
    <Dialog open={view === 'details'} onOpenChange={(nextOpen) => !nextOpen && setView('actions')}>
      <DialogContent className="h-[100dvh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] overflow-y-auto rounded-none border-0 p-6 sm:rounded-none">
        <DialogHeader>
          <DialogTitle>Message Details</DialogTitle>
          <DialogDescription>Delivery and thread metadata.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">ID:</span> {message.id}</div>
          <div><span className="text-muted-foreground">Type:</span> {message.kind}</div>
          <div><span className="text-muted-foreground">Status:</span> {message.status}</div>
          <div><span className="text-muted-foreground">Created:</span> {formatMessageDateTime(message.createdAt) || '—'}</div>
          <div><span className="text-muted-foreground">Updated:</span> {formatMessageDateTime(message.updatedAt) || '—'}</div>
          <div><span className="text-muted-foreground">Edited:</span> {formatMessageDateTime(message.editedAt) || '—'}</div>
          <div><span className="text-muted-foreground">Deleted:</span> {formatMessageDateTime(message.deletedAt) || '—'}</div>
          <div><span className="text-muted-foreground">Reply Mode:</span> {message.replyMode || '—'}</div>
          <div><span className="text-muted-foreground">Reply To:</span> {message.replyToMessageId || '—'}</div>
          <div><span className="text-muted-foreground">Thread Root:</span> {message.threadRootId || '—'}</div>
          <div><span className="text-muted-foreground">Thread Replies:</span> {message.threadReplyCount}</div>
          <div><span className="text-muted-foreground">Last Thread Reply:</span> {formatMessageDateTime(message.lastThreadReplyAt) || '—'}</div>
          <div><span className="text-muted-foreground">Reactions:</span> {message.reactions.length}</div>
        </div>

        <div className="flex justify-start pt-2">
          <Button variant="ghost" size="sm" onClick={() => setView('actions')}>
            Back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return createPortal(
    <>
      {view !== 'details' ? (
        <div className="fixed inset-0 z-50 pointer-events-none" aria-hidden={!open}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            className={cn(
              'pointer-events-auto absolute overflow-hidden rounded-3xl border border-border/70 bg-background/98 shadow-2xl backdrop-blur',
              isMobileLayout(anchor) ? 'w-[min(320px,calc(100vw-24px))]' : 'w-[220px]'
            )}
            style={panelStyle}
          >
            {view === 'actions' ? renderActions() : null}
            {view === 'edit' ? renderEdit() : null}
          </div>
        </div>
      ) : null}
      {view === 'details' ? renderDetails() : null}
    </>,
    document.body
  );
}
