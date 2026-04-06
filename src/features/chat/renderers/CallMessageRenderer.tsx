import React from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CallMessage } from '../types/message';
import { MessageBubble, MessageContent } from '../components/MessageShell';
import { MessageReplyPreview } from '../components/MessageReplyPreview';
import {
  getCallStatusDetail,
  getCallSummaryText,
  getCallTone,
  getCallTypeLabel,
} from '../utils/callPresentation';

interface CallMessageRendererProps {
  message: CallMessage;
  highlighted?: boolean;
  groupedWithAbove?: boolean;
  groupedWithBelow?: boolean;
  bubbleFooter?: React.ReactNode;
}

const toneClassNames = {
  success: {
    bubble: 'border-emerald-200/80 bg-emerald-50/90 text-emerald-950',
    badge: 'bg-emerald-100 text-emerald-700',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  warning: {
    bubble: 'border-amber-200/80 bg-amber-50/95 text-amber-950',
    badge: 'bg-amber-100 text-amber-700',
    chip: 'bg-amber-100 text-amber-800',
  },
  muted: {
    bubble: 'border-slate-200/80 bg-slate-50/95 text-slate-950',
    badge: 'bg-slate-200 text-slate-700',
    chip: 'bg-slate-200 text-slate-800',
  },
} as const;

export const CallMessageRenderer: React.FC<CallMessageRendererProps> = ({
  message,
  highlighted = false,
  groupedWithAbove = false,
  groupedWithBelow = false,
  bubbleFooter,
}) => {
  const tone = getCallTone(message.call.status);
  const toneClasses = toneClassNames[tone];
  const summary = getCallSummaryText({
    direction: message.callDirection,
    type: message.call.type,
    status: message.call.status,
    durationMs: message.call.duration_ms,
  });
  const statusDetail = getCallStatusDetail({
    direction: message.callDirection,
    type: message.call.type,
    status: message.call.status,
    durationMs: message.call.duration_ms,
  });
  const DirectionIcon = message.callDirection === 'incoming' ? PhoneIncoming : PhoneOutgoing;
  const TypeIcon = message.call.type === 'video' ? Video : Phone;

  return (
    <MessageBubble
      isOwn={message.isOwn}
      highlighted={highlighted}
      groupedWithAbove={groupedWithAbove}
      groupedWithBelow={groupedWithBelow}
      className={cn('max-w-full min-w-0 border shadow-none', toneClasses.bubble)}
    >
      <MessageReplyPreview message={message} />
      <MessageContent className="py-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
              toneClasses.badge
            )}
          >
            <TypeIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{summary}</div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-current/70">
                  <DirectionIcon className="h-3.5 w-3.5" />
                  <span className="truncate">
                    {message.callDirection === 'incoming' ? 'Incoming' : 'Outgoing'} ·{' '}
                    {getCallTypeLabel(message.call.type)}
                  </span>
                </div>
              </div>
              {statusDetail ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    toneClasses.chip
                  )}
                >
                  {statusDetail}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </MessageContent>
      {bubbleFooter}
    </MessageBubble>
  );
};
