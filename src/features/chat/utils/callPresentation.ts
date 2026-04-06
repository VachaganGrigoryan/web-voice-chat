import { CallDirection, CallMeta, CallType } from '@/api/types';
import { formatDuration } from '@/utils/dateUtils';

type TerminalCallStatus = CallMeta['status'];

interface CallSummaryInput {
  direction: CallDirection;
  type: CallType;
  status: TerminalCallStatus;
  durationMs?: number | null;
}

export const getCallDirectionFromMeta = (
  call: Pick<CallMeta, 'caller_user_id' | 'callee_user_id'>,
  currentUserId?: string | null
): CallDirection => (currentUserId && currentUserId === call.caller_user_id ? 'outgoing' : 'incoming');

export const getCallTypeLabel = (type: CallType) =>
  type === 'video' ? 'Video call' : 'Audio call';

export const getCallSummaryText = ({
  direction,
  type,
  status,
}: CallSummaryInput) => {
  const typeLabel = type === 'video' ? 'video call' : 'audio call';

  switch (status) {
    case 'ended':
      return `${direction === 'incoming' ? 'Incoming' : 'Outgoing'} ${typeLabel}`;
    case 'expired':
      return direction === 'incoming' ? `Missed ${typeLabel}` : `Unanswered ${typeLabel}`;
    case 'rejected':
      return direction === 'incoming' ? `Declined ${typeLabel}` : `Rejected ${typeLabel}`;
    case 'cancelled':
      return direction === 'incoming'
        ? `Incoming ${typeLabel} cancelled`
        : `Cancelled ${typeLabel}`;
    default:
      return getCallTypeLabel(type);
  }
};

export const getCallStatusDetail = ({
  direction,
  status,
  durationMs,
}: CallSummaryInput) => {
  if (status === 'ended' && durationMs && durationMs > 0) {
    return formatDuration(durationMs);
  }

  switch (status) {
    case 'ended':
      return 'Connected';
    case 'expired':
      return direction === 'incoming' ? 'Missed' : 'No answer';
    case 'rejected':
      return direction === 'incoming' ? 'Declined' : 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
};

export const getCallTone = (
  status: TerminalCallStatus
): 'success' | 'warning' | 'muted' => {
  if (status === 'ended') {
    return 'success';
  }

  if (status === 'expired') {
    return 'warning';
  }

  return 'muted';
};
