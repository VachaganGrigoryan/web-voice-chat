import type { MouseEvent as ReactMouseEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Loader2, MoreVertical, Phone, PhoneMissed, Video } from 'lucide-react';
import { conversationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { CallHistoryItem } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  CallHistoryActionsMenu,
  type CallHistoryMenuState,
} from '@/features/chat/components/CallHistoryActionsMenu';
import { formatConversationTimestamp } from '@/features/chat/components/inbox/inboxPreview';
import {
  getCallStatusDetail,
  getCallSummaryText,
} from '@/features/chat/utils/callPresentation';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/utils/dateUtils';
import { toast } from 'sonner';
import { ActivitySection } from './ActivitySignalConsole';

export interface CallLogsState {
  readonly history: readonly CallHistoryItem[];
  readonly fetchNextPage: () => Promise<unknown>;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isLoading: boolean;
  readonly deleteHistory: (peerUserId?: string) => Promise<{ deleted_count: number }>;
  readonly isDeletingHistory: boolean;
}

function getCallHistoryPeerLabel(peer: CallHistoryItem['peer_user']) {
  return peer.display_name || peer.username || peer.id;
}

async function openDmConversationForUser(
  userId: string,
  navigate: ReturnType<typeof useNavigate>,
  queryClient: ReturnType<typeof useQueryClient>
) {
  try {
    const conversation = await conversationsApi.createOrGetDm(userId);
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    navigate(APP_ROUTES.dm(conversation.id));
  } catch (error) {
    toast.error(extractApiError(error, 'Failed to open chat'));
  }
}

function CallLogListItem({
  item,
  isMenuOpen,
  onSelect,
  onOpenMenu,
  onOpenMenuAtPoint,
}: {
  item: CallHistoryItem;
  isMenuOpen: boolean;
  onSelect: () => void;
  onOpenMenu: (event: ReactMouseEvent<HTMLElement>) => void;
  onOpenMenuAtPoint: (event: ReactMouseEvent<HTMLElement>) => void;
}) {
  const preview = getCallSummaryText({
    direction: item.direction,
    type: item.type,
    status: item.status,
    durationMs: item.duration_ms,
  });
  const detail = getCallStatusDetail({
    direction: item.direction,
    type: item.type,
    status: item.status,
    durationMs: item.duration_ms,
  });
  const timestamp = formatConversationTimestamp(item.ended_at || item.started_at);
  const secondaryLabel = detail
    ? detail
    : item.duration_ms > 0
      ? formatDuration(item.duration_ms)
      : item.type === 'video'
        ? 'Video call'
        : 'Audio call';
  const CallTypeIcon = item.type === 'video' ? Video : Phone;
  const DirectionIcon = item.direction === 'incoming' ? ArrowDownLeft : ArrowUpRight;
  const peerLabel = getCallHistoryPeerLabel(item.peer_user);
  const isMissed = item.status !== 'ended';

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all duration-200 motion-reduce:transition-none',
        isMissed
          ? 'border-rose-200/80 bg-rose-50/70 shadow-e1 hover:border-rose-300 dark:border-rose-900/60 dark:bg-rose-950/20'
          : 'border-border/60 bg-background/75 shadow-e1 hover:border-border/80 hover:bg-background/95 hover:shadow-e2'
      )}
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenMenuAtPoint(event);
      }}
    >
      <button
        type="button"
        className="flex w-full min-w-0 items-center gap-3 rounded-[18px] px-2.5 py-2 pr-14 text-left transition-colors"
        onClick={onSelect}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 border border-border/60 bg-background">
            {item.peer_user.avatar ? <AvatarImage src={item.peer_user.avatar.url} /> : null}
            <AvatarFallback>{(peerLabel[0] || '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-background bg-muted text-muted-foreground">
            <CallTypeIcon className="h-3 w-3" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="truncate pr-1 text-left text-sm font-medium text-foreground/90">{peerLabel}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{timestamp}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                item.direction === 'incoming'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-sky-500/10 text-sky-700 dark:text-sky-300'
              )}
            >
              <DirectionIcon className="h-3 w-3" />
              {item.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                isMissed
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {isMissed ? <PhoneMissed className="h-3 w-3" /> : null}
              {preview}
            </span>
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{secondaryLabel}</div>
        </div>
      </button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'absolute right-1.5 top-1/2 h-11 w-11 -translate-y-1/2 rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
          'opacity-100 md:opacity-0 md:group-hover:opacity-100',
          isMenuOpen && 'bg-muted text-foreground opacity-100'
        )}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(event);
        }}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CallMetricCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone: 'sky' | 'emerald' | 'rose' | 'amber';
}) {
  const toneClassName =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300'
      : tone === 'rose'
        ? 'border-rose-200 bg-rose-50/80 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-300'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300'
          : 'border-sky-200 bg-sky-50/80 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300';

  return (
    <div className={cn('rounded-2xl border p-4 shadow-e1', toneClassName)}>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{label}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

export function CallLogsTab({ state }: { state?: CallLogsState }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState<CallHistoryMenuState | null>(null);

  const localState = useCallHistory({ enabled: !state });
  const activeState: CallLogsState = state ?? {
    history: localState.history,
    fetchNextPage: localState.fetchNextPage,
    hasNextPage: localState.hasNextPage,
    isFetchingNextPage: localState.isFetchingNextPage,
    isLoading: localState.isLoading,
    deleteHistory: localState.deleteHistory,
    isDeletingHistory: localState.isDeletingHistory,
  };
  const {
    history: callHistory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    deleteHistory,
    isDeletingHistory,
  } = activeState;

  const endedCalls = callHistory.filter((item) => item.status === 'ended').length;
  const missedCalls = callHistory.length - endedCalls;
  const videoCalls = callHistory.filter((item) => item.type === 'video').length;
  const talkTimeMs = callHistory.reduce(
    (total, item) => total + Math.max(item.duration_ms, 0),
    0
  );

  const openMenu = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({
      peerUserId,
      rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
    });
  };

  const openMenuAtPoint = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    setMenu({
      peerUserId,
      rect: { top: event.clientY, right: event.clientX, bottom: event.clientY, left: event.clientX },
    });
  };

  const clearPeerHistory = async (peerUserId: string) => {
    try {
      const result = await deleteHistory(peerUserId);
      setMenu(null);
      toast.success(`Cleared ${result.deleted_count} call log${result.deleted_count === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to clear call history'));
    }
  };

  const clearAllHistory = async () => {
    try {
      const result = await deleteHistory();
      toast.success(`Cleared ${result.deleted_count} call log${result.deleted_count === 1 ? '' : 's'}`);
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to clear call history'));
    }
  };

  return (
    <ActivitySection
      title="Call Logs"
      description="Audio and video call history across your conversations."
      action={
        callHistory.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs font-semibold"
            onClick={() => void clearAllHistory()}
            disabled={isDeletingHistory}
          >
            {isDeletingHistory ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Clear all
          </Button>
        ) : null
      }
    >
      <CallHistoryActionsMenu
        menu={menu}
        isMobile={isMobile}
        isClearingHistory={isDeletingHistory}
        onOpenChange={(open) => {
          if (!open) setMenu(null);
        }}
        onClearHistory={(peerUserId) => void clearPeerHistory(peerUserId)}
      />

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
          <CallMetricCard
            label="Calls loaded"
            value={callHistory.length}
            detail={`${endedCalls} ended`}
            tone="sky"
          />
          <CallMetricCard
            label="Talk time"
            value={talkTimeMs ? formatDuration(talkTimeMs) : '0m'}
            detail="Completed duration"
            tone="emerald"
          />
          <CallMetricCard
            label="Video calls"
            value={videoCalls}
            detail="Camera sessions"
            tone="amber"
          />
          <CallMetricCard
            label="Missed / early"
            value={missedCalls}
            detail="Rejected, cancelled or expired"
            tone="rose"
          />
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading call logs...
          </div>
        ) : callHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No recent calls
          </div>
        ) : (
          callHistory.map((item) => (
            <CallLogListItem
              key={item.id}
              item={item}
              isMenuOpen={menu?.peerUserId === item.peer_user.id}
              onSelect={() => void openDmConversationForUser(item.peer_user.id, navigate, queryClient)}
              onOpenMenu={(event) => openMenu(event, item.peer_user.id)}
              onOpenMenuAtPoint={(event) => openMenuAtPoint(event, item.peer_user.id)}
            />
          ))
        )}

        {hasNextPage ? (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-2xl"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load more calls'
            )}
          </Button>
        ) : null}
      </div>
    </ActivitySection>
  );
}
