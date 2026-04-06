import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Info, MessageSquareReply, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import { formatDuration, formatMessageDateTime, toLocalBrowserDate } from '@/utils/dateUtils';
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
type DetailsTab = 'summary' | 'debug';

interface ActionItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
}

interface DetailFieldConfig {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
}

const MENU_WIDTH = 220;
const MOBILE_WIDTH = 320;
const DESKTOP_GAP = 12;
const VIEWPORT_PADDING = 12;
const EDIT_WINDOW_MS = 15 * 60 * 1000;

const getCopyText = (message: ChatMessage) => {
  if (message.isDeleted) return '';
  if (message.kind === 'text' || message.kind === 'emoji' || message.kind === 'system') return message.text.trim();
  if (message.kind === 'image' || message.kind === 'video' || message.kind === 'file') return (message.caption || '').trim();
  return '';
};

const getMessagePreviewText = (message: ChatMessage) => {
  if (message.isDeleted) return 'Message deleted';

  switch (message.kind) {
    case 'text':
    case 'emoji':
    case 'system':
      return message.text || 'Empty text';
    case 'image':
      return message.caption || message.fileName || 'Image message';
    case 'video':
      return message.caption || message.fileName || 'Video message';
    case 'audio':
      return message.caption || message.fileName || 'Audio message';
    case 'file':
      return message.caption || message.fileName || 'File message';
    case 'call':
      return `${humanizeValue(message.callDirection)} ${message.call.type} call`;
    case 'sticker':
      return 'Sticker';
    case 'unknown':
      return message.text || message.originalType || 'Unknown message';
    default:
      return 'Message';
  }
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
  const estimatedHeight = view === 'actions' ? 320 : 340;

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

function canEditMessage(message: ChatMessage | null): boolean {
  if (!message || !message.isOwn || message.kind !== 'text' || message.isDeleted) {
    return false;
  }

  const createdAt = toLocalBrowserDate(message.createdAt);
  const createdAtMs = createdAt.getTime();

  if (Number.isNaN(createdAtMs)) {
    return false;
  }

  return Date.now() - createdAtMs <= EDIT_WINDOW_MS;
}

function humanizeValue(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateValue(value?: string) {
  return value ? formatMessageDateTime(value) || '—' : '—';
}

function formatBytes(bytes?: number) {
  if (!Number.isFinite(bytes) || bytes === undefined) {
    return '—';
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = bytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function describeReplyPreview(message: ChatMessage) {
  if (!message.replyPreview) {
    return '—';
  }

  if (message.replyPreview.is_deleted) {
    return 'Deleted message';
  }

  const prefix = message.replyPreview.media_kind
    ? `${humanizeValue(message.replyPreview.media_kind)}: `
    : '';

  return `${prefix}${message.replyPreview.text || 'No preview text'}`;
}

function getPayloadFields(message: ChatMessage): DetailFieldConfig[] {
  switch (message.kind) {
    case 'text':
    case 'emoji':
    case 'system':
      return [
        {
          label: 'Text',
          value: message.text || '—',
          fullWidth: true,
        },
      ];
    case 'image':
      return [
        { label: 'Caption', value: message.caption || '—', fullWidth: true },
        { label: 'File Name', value: message.fileName || '—' },
        { label: 'Image URL', value: message.imageUrl || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.media?.mime || '—' },
        { label: 'Size', value: formatBytes(message.media?.size_bytes) },
      ];
    case 'video':
      return [
        { label: 'Caption', value: message.caption || '—', fullWidth: true },
        { label: 'File Name', value: message.fileName || '—' },
        { label: 'Video URL', value: message.videoUrl || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.media?.mime || '—' },
        { label: 'Size', value: formatBytes(message.media?.size_bytes) },
        { label: 'Duration', value: message.media?.duration_ms ? formatDuration(message.media.duration_ms) : '—' },
      ];
    case 'audio':
      return [
        { label: 'Caption', value: message.caption || '—', fullWidth: true },
        { label: 'File Name', value: message.fileName || '—' },
        { label: 'Audio URL', value: message.audioUrl || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.media?.mime || '—' },
        { label: 'Size', value: formatBytes(message.media?.size_bytes) },
        { label: 'Duration', value: message.media?.duration_ms ? formatDuration(message.media.duration_ms) : '—' },
      ];
    case 'file':
      return [
        { label: 'Caption', value: message.caption || '—', fullWidth: true },
        { label: 'File Name', value: message.fileName || '—' },
        { label: 'File URL', value: message.fileUrl || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.mimeType || '—' },
        { label: 'Size', value: formatBytes(message.fileSizeBytes) },
      ];
    case 'sticker':
      return [
        { label: 'Sticker URL', value: message.stickerUrl || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.media?.mime || '—' },
        { label: 'Size', value: formatBytes(message.media?.size_bytes) },
      ];
    case 'call':
      return [
        { label: 'Call ID', value: message.call.call_id, mono: true },
        { label: 'Direction', value: humanizeValue(message.callDirection) },
        { label: 'Type', value: humanizeValue(message.call.type) },
        { label: 'Status', value: humanizeValue(message.call.status) },
        { label: 'Caller', value: message.call.caller_user_id, mono: true },
        { label: 'Callee', value: message.call.callee_user_id, mono: true },
        { label: 'Started', value: formatDateValue(message.call.started_at) },
        { label: 'Answered', value: formatDateValue(message.call.answered_at || undefined) },
        { label: 'Ended', value: formatDateValue(message.call.ended_at || undefined) },
        { label: 'Duration', value: formatDuration(message.call.duration_ms) },
      ];
    case 'unknown':
      return [
        { label: 'Original Type', value: message.originalType || '—' },
        { label: 'Text', value: message.text || '—', fullWidth: true },
        { label: 'Media URL', value: message.media?.url || '—', mono: true, fullWidth: true },
        { label: 'Storage Key', value: message.media?.key || '—', mono: true, fullWidth: true },
        { label: 'MIME Type', value: message.media?.mime || '—' },
        { label: 'Size', value: formatBytes(message.media?.size_bytes) },
      ];
    default:
      return [];
  }
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error('Copy failed');
  }
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

const DetailField = ({
  label,
  value,
  mono = false,
  fullWidth = false,
}: DetailFieldConfig) => (
  <div
    className={cn(
      'rounded-2xl border border-border/70 bg-muted/20 p-4',
      fullWidth && 'sm:col-span-2 xl:col-span-3'
    )}
  >
    <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
    <dd
      className={cn(
        'mt-2 break-words text-sm font-medium text-foreground',
        mono && 'font-mono text-[13px] leading-6',
        typeof value === 'string' && value.includes('\n') && 'whitespace-pre-wrap'
      )}
    >
      {value}
    </dd>
  </div>
);

function MessageDetailsPanel({
  message,
  detailsTab,
  onDetailsTabChange,
  onBack,
  onClose,
}: {
  message: ChatMessage;
  detailsTab: DetailsTab;
  onDetailsTabChange: (value: DetailsTab) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const payloadFields = useMemo(() => getPayloadFields(message), [message]);
  const rawJson = useMemo(() => JSON.stringify(message.raw, null, 2), [message]);
  const parsedJson = useMemo(() => {
    const { raw, ...parsedMessage } = message;
    return JSON.stringify(parsedMessage, null, 2);
  }, [message]);

  const overviewFields: DetailFieldConfig[] = [
    { label: 'Preview', value: getMessagePreviewText(message), fullWidth: true },
    { label: 'Kind', value: humanizeValue(message.kind) },
    { label: 'Status', value: humanizeValue(message.status) },
    { label: 'Direction', value: message.isOwn ? 'Outgoing' : 'Incoming' },
    { label: 'Deleted', value: message.isDeleted ? 'Yes' : 'No' },
    { label: 'Thread Root', value: message.isThreadRoot ? 'Yes' : 'No' },
  ];

  const timingFields: DetailFieldConfig[] = [
    { label: 'Created', value: formatDateValue(message.createdAt) },
    { label: 'Updated', value: formatDateValue(message.updatedAt) },
    { label: 'Delivered', value: formatDateValue(message.deliveredAt) },
    { label: 'Read', value: formatDateValue(message.readAt) },
    { label: 'Edited', value: formatDateValue(message.editedAt) },
    { label: 'Deleted', value: formatDateValue(message.deletedAt) },
  ];

  const threadFields: DetailFieldConfig[] = [
    { label: 'Reply Mode', value: message.replyMode ? humanizeValue(message.replyMode) : '—' },
    { label: 'Reply To', value: message.replyToMessageId || '—', mono: true },
    { label: 'Reply Preview', value: describeReplyPreview(message), fullWidth: true },
    { label: 'Thread Root ID', value: message.threadRootId || '—', mono: true },
    { label: 'Thread Replies', value: String(message.threadReplyCount) },
    { label: 'Unread Replies', value: String(message.unreadThreadReplyCount) },
    { label: 'Last Thread Reply', value: formatDateValue(message.lastThreadReplyAt) },
  ];

  const identityFields: DetailFieldConfig[] = [
    { label: 'Message ID', value: message.id, mono: true, fullWidth: true },
    { label: 'Conversation ID', value: message.chatId, mono: true, fullWidth: true },
    { label: 'Sender ID', value: message.senderId, mono: true, fullWidth: true },
    { label: 'Receiver ID', value: message.receiverId, mono: true, fullWidth: true },
    { label: 'Client Batch ID', value: message.clientBatchId || '—', mono: true, fullWidth: true },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="h-full" onClick={(event) => event.stopPropagation()}>
        <Tabs
          value={detailsTab}
          onValueChange={(value) => onDetailsTabChange(value as DetailsTab)}
          className="h-full"
        >
          <PanelPageLayout
            title="Message Details"
            description="Structured message data for support, QA, and debugging."
            onBack={onBack}
            onClose={onClose}
            nav={
              <TabsList className="grid w-full max-w-sm grid-cols-2">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="debug">Debug JSON</TabsTrigger>
              </TabsList>
            }
            contentClassName="space-y-4"
          >
            <TabsContent value="summary" className="mt-0 space-y-4">
              <PanelSection title="Overview" description="Human-readable status and message context.">
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {overviewFields.map((field) => (
                    <DetailField key={field.label} {...field} />
                  ))}
                </dl>
              </PanelSection>

              <PanelSection title="Timing" description="Message lifecycle timestamps as seen in the client.">
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {timingFields.map((field) => (
                    <DetailField key={field.label} {...field} />
                  ))}
                </dl>
              </PanelSection>

              <PanelSection title="Threading" description="Reply and thread metadata attached to this message.">
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {threadFields.map((field) => (
                    <DetailField key={field.label} {...field} />
                  ))}
                </dl>
              </PanelSection>

              <PanelSection title="Payload" description="Content-specific fields for this message kind.">
                {payloadFields.length > 0 ? (
                  <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {payloadFields.map((field) => (
                      <DetailField key={field.label} {...field} />
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">No extra payload fields for this message.</p>
                )}
              </PanelSection>

              <PanelSection title="Reactions" description="Reaction groups currently attached to the message.">
                {message.reactions.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {message.reactions.map((reaction) => (
                      <div
                        key={reaction.emoji}
                        className="rounded-2xl border border-border/70 bg-muted/20 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-2xl leading-none">{reaction.emoji}</span>
                          <span className="rounded-full bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
                            {reaction.count}
                          </span>
                        </div>
                        <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          User IDs
                        </div>
                        <div className="mt-2 break-words font-mono text-[12px] leading-6 text-foreground">
                          {reaction.user_ids.join('\n') || '—'}
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Updated {formatDateValue(reaction.updated_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No reactions on this message.</p>
                )}
              </PanelSection>

              <PanelSection title="Identifiers" description="Internal IDs that help trace the message across systems.">
                <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {identityFields.map((field) => (
                    <DetailField key={field.label} {...field} />
                  ))}
                </dl>
              </PanelSection>
            </TabsContent>

            <TabsContent value="debug" className="mt-0 space-y-4">
              <PanelSection
                title="Server Payload"
                description="Original API payload before client-side parsing."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard(rawJson, 'Raw JSON copied')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy JSON
                  </Button>
                }
              >
                <pre className="scrollbar-hidden overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 font-mono text-[12px] leading-6 text-foreground">
                  {rawJson}
                </pre>
              </PanelSection>

              <PanelSection
                title="Parsed Message"
                description="Client-facing message object after parsing and normalization."
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void copyToClipboard(parsedJson, 'Parsed JSON copied')}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy JSON
                  </Button>
                }
              >
                <pre className="scrollbar-hidden overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 font-mono text-[12px] leading-6 text-foreground">
                  {parsedJson}
                </pre>
              </PanelSection>
            </TabsContent>
          </PanelPageLayout>
        </Tabs>
      </div>
    </div>,
    document.body
  );
}

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
  const [detailsTab, setDetailsTab] = useState<DetailsTab>('summary');
  const [draftText, setDraftText] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      setView('actions');
      setDetailsTab('summary');
      setDraftText('');
      return;
    }

    setView('actions');
    setDetailsTab('summary');
    setDraftText(message?.kind === 'text' ? message.text : '');
  }, [message, open]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (view === 'details') {
        setView('actions');
        return;
      }

      onOpenChange(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange, view]);

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
  const canEdit = canEditMessage(message);
  const canDelete = !!message && message.kind !== 'system' && !message.isDeleted;

  useEffect(() => {
    if (view === 'edit' && !canEdit) {
      setView('actions');
    }
  }, [canEdit, view]);

  const actions = useMemo<ActionItem[]>(() => {
    if (!message) return [];

    const items: ActionItem[] = [];

    if (canCopy) {
      items.push({
        key: 'copy',
        label: 'Copy',
        icon: <Copy className="h-4 w-4" />,
        onSelect: async () => {
          await copyToClipboard(copyText, 'Copied');
          onOpenChange(false);
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

      {view === 'details' ? (
        <MessageDetailsPanel
          message={message}
          detailsTab={detailsTab}
          onDetailsTabChange={setDetailsTab}
          onBack={() => setView('actions')}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </>,
    document.body
  );
}
