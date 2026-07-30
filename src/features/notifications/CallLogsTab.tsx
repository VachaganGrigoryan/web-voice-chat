import type { MouseEvent as ReactMouseEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MoreVertical, Phone, Video } from 'lucide-react';
import { conversationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { CallHistoryItem } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { PanelSection } from '@/components/panel/PanelPageLayout';
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
  const peerLabel = getCallHistoryPeerLabel(item.peer_user);

  return (
    <div
      className={cn(
        'group relative w-full min-w-0 overflow-hidden rounded-2xl border p-1.5 transition-all',
        'border-border/60 bg-background/75 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-border/80 hover:bg-background/95 hover:shadow-sm'
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
          <div className="mt-1 truncate text-xs font-medium text-foreground">{preview}</div>
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

export function CallLogsTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [menu, setMenu] = useState<CallHistoryMenuState | null>(null);

  const {
    history: callHistory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    deleteHistory,
    isDeletingHistory,
  } = useCallHistory({ enabled: true });

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
    <PanelSection
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

      <div className="mx-auto w-full max-w-2xl space-y-2">
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
    </PanelSection>
  );
}
