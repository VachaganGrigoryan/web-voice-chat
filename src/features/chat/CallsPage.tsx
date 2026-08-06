import type { MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, MoreVertical, Phone, Video } from 'lucide-react';
import { conversationsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { CallHistoryItem } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useCallHistory } from '@/hooks/useCallHistory';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useChatDialogs } from './ChatDialogsProvider';
import { CallHistoryActionsMenu } from './components/CallHistoryActionsMenu';
import { formatConversationTimestamp } from './components/inbox/inboxPreview';
import { getCallDirectionFromMeta, getCallStatusDetail, getCallSummaryText } from './utils/callPresentation';
import { formatDuration } from '@/utils/dateUtils';

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
    navigate(APP_ROUTES.chatConversation(conversation.id));
  } catch (error) {
    toast.error(extractApiError(error, 'Failed to open chat'));
  }
}

function CallHistoryListItem({
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

/** `/calls` — call history across every peer, with per-row and bulk clearing. */
export default function CallsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialogs = useChatDialogs();
  const { callHistoryMenu } = dialogs.state;

  const {
    history: callHistory,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useCallHistory({ enabled: true });

  const openMenu = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    const rect = event.currentTarget.getBoundingClientRect();
    dialogs.setCallHistoryMenu({
      peerUserId,
      rect: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
    });
  };

  const openMenuAtPoint = (event: ReactMouseEvent<HTMLElement>, peerUserId: string) => {
    dialogs.setCallHistoryMenu({
      peerUserId,
      rect: { top: event.clientY, right: event.clientX, bottom: event.clientY, left: event.clientX },
    });
  };

  const getCallHistoryLabel = (peerUserId: string) => {
    const historyItem = callHistory.find((item) => item.peer_user.id === peerUserId);
    return historyItem?.peer_user.display_name || historyItem?.peer_user.username || peerUserId;
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <CallHistoryActionsMenu
        menu={callHistoryMenu}
        isMobile={false}
        isClearingHistory={false}
        onOpenChange={(open) => {
          if (!open) dialogs.setCallHistoryMenu(null);
        }}
        onClearHistory={(peerUserId) => {
          dialogs.setCallHistoryMenu(null);
          dialogs.requestDestructiveAction({
            kind: 'clearCallHistoryPeer',
            peerUserId,
            label: getCallHistoryLabel(peerUserId),
          });
        }}
      />

      <div className="flex shrink-0 items-center justify-between border-b px-6 py-4">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Calls</h1>
        {callHistory.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide"
            onClick={() => dialogs.requestDestructiveAction({ kind: 'clearCallHistoryAll' })}
          >
            Clear all
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-2xl space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading call history…
            </div>
          ) : callHistory.length === 0 ? (
            <div className="m-1 rounded-lg border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No recent calls
            </div>
          ) : (
            callHistory.map((item) => (
              <CallHistoryListItem
                key={item.id}
                item={item}
                isMenuOpen={callHistoryMenu?.peerUserId === item.peer_user.id}
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
                  Loading…
                </>
              ) : (
                'Load more calls'
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
