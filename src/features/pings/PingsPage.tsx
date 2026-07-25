import { ReactNode, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES, isPingsTab, PingsTab } from '@/app/routes';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { usePings } from '@/hooks/usePings';
import { useNotifications } from '@/hooks/useNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationView, PingItem } from '@/api/types';
import { conversationsApi, spacesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { cn } from '@/lib/utils';
import { useAppNavigation } from '@/navigation/appNavigation';
import { toast } from 'sonner';
import {
  Bell,
  Check,
  Loader2,
  MessageSquare,
  KeyRound,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { JoinByInviteDialog } from '@/features/chat/components/JoinByInviteDialog';

type PingMetaLabel = {
  desktop: string;
  mobile: string;
};

function formatCompactRelative(date: Date) {
  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return 'now';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d`;
  }

  const weeks = Math.floor(days / 7);
  if (weeks < 5) {
    return `${weeks}w`;
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months}mo`;
  }

  const years = Math.floor(days / 365);
  return `${years}y`;
}

function buildPingMetaLabel(
  desktopPrefix: string,
  mobilePrefix: string,
  value: string
): PingMetaLabel {
  const date = new Date(value);

  return {
    desktop: `${desktopPrefix} ${formatDistanceToNow(date, { addSuffix: true })}`,
    mobile: `${mobilePrefix} ${formatCompactRelative(date)}`,
  };
}

function PingStatusBadge({ status }: { status: PingItem['ping']['status'] }) {
  const badgeClassName =
    status === 'accepted'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
      : status === 'declined'
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : status === 'cancelled'
          ? 'border-muted-foreground/20 bg-muted text-muted-foreground'
          : status === 'blocked'
            ? 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300'
            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
  const label =
    status === 'accepted'
      ? 'Accepted'
      : status === 'declined'
        ? 'Declined'
        : status === 'cancelled'
          ? 'Cancelled'
          : status === 'blocked'
            ? 'Blocked'
            : 'Pending';

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold', badgeClassName)}>
      {label}
    </span>
  );
}

function PingPersonCard({
  item,
  metaLabel,
  actions,
}: {
  item: PingItem;
  metaLabel: PingMetaLabel;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar className="h-11 w-11 shrink-0 border">
          {item.peer.avatar ? <AvatarImage src={item.peer.avatar.url} className="object-cover" /> : null}
          <AvatarFallback>{(item.peer.display_name || item.peer.username || '?')[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {item.peer.display_name || item.peer.username || 'Unknown User'}
              </div>
              {item.peer.username ? <div className="truncate text-xs text-muted-foreground">@{item.peer.username}</div> : null}
            </div>
            <div className="shrink-0">
              <PingStatusBadge status={item.ping.status} />
            </div>
          </div>

          <div className="min-w-0 text-[11px] text-muted-foreground sm:text-xs">
            <span className="block truncate sm:hidden">{metaLabel.mobile}</span>
            <span className="hidden truncate sm:block">{metaLabel.desktop}</span>
          </div>
        </div>
      </div>

      {actions ? <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">{actions}</div> : null}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <PanelSection>
      <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
        <div className="rounded-full bg-muted p-4">{icon}</div>
        <div className="space-y-1">
          <div className="text-base font-medium">{title}</div>
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
    </PanelSection>
  );
}

function describeNotification(
  notification: NotificationView,
  peerName: string | null
): { title: string; description: string } {
  const name = peerName ? `@${peerName}` : 'Someone';
  switch (notification.kind) {
    case 'ping_received':
      return { title: 'New connection request', description: `${name} wants to connect with you.` };
    case 'ping_accepted':
      return { title: 'Connection accepted', description: `${name} accepted your connection request.` };
    case 'ping_declined':
      return { title: 'Connection declined', description: `${name} declined your connection request.` };
    case 'ping_cancelled':
      return { title: 'Request withdrawn', description: `${name} withdrew a connection request.` };
    case 'user_blocked':
      return { title: 'User blocked', description: `You blocked ${name}.` };
    case 'message':
      return { title: 'New message', description: 'You have a new message.' };
    case 'space_invite': {
      const spaceName = notification.data?.space_name || 'a space';
      const inviter = notification.data?.invited_by || 'Someone';
      return { title: 'Space Invitation', description: `${inviter} invited you to join "${spaceName}".` };
    }
    default:
      return { title: 'Notification', description: notification.kind };
  }
}

function NotificationFeedItem({
  notification,
  matchedPing,
  onAccept,
  onDecline,
  onOpenConversation,
  isAccepting,
  isDeclining,
  onAcceptSpaceInvite,
  onDeclineSpaceInvite,
  isAcceptingSpaceInvite,
}: {
  notification: NotificationView;
  matchedPing: PingItem | null;
  onAccept: (ping: PingItem) => void;
  onDecline: (pingId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  onAcceptSpaceInvite: (code: string) => void;
  onDeclineSpaceInvite: (notificationId: string) => void;
  isAcceptingSpaceInvite: boolean;
}) {
  const peer = matchedPing?.peer ?? null;
  const { title, description } = describeNotification(notification, peer?.username ?? null);
  const isUnread = notification.read_at === null;
  const relative = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });
  const canAcceptDecline = notification.kind === 'ping_received' && matchedPing !== null;
  const isSpaceInvite = notification.kind === 'space_invite';
  const inviteCode = notification.data?.code as string | undefined;
  const canAcceptDeclineSpace = isSpaceInvite && !!inviteCode;
  const conversationId =
    notification.kind === 'message' ? notification.conversation_id : null;

  return (
    <div
      className={cn(
        'rounded-2xl border p-4',
        isUnread ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background/80'
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="rounded-full bg-muted p-2">
          {notification.kind === 'message' ? (
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ) : notification.kind === 'user_blocked' ? (
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Bell className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{description}</div>
          <div className="text-[11px] text-muted-foreground">{relative}</div>
        </div>
      </div>

      {(canAcceptDecline || canAcceptDeclineSpace || conversationId) && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          {canAcceptDecline && matchedPing ? (
            <>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-full sm:w-auto"
                onClick={() => onAccept(matchedPing)}
                disabled={isAccepting}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={() => onDecline(matchedPing.ping.id)}
                disabled={isDeclining}
              >
                <X className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
            </>
          ) : null}
          {canAcceptDeclineSpace && inviteCode && (
            <>
              <Button
                type="button"
                size="sm"
                className="w-full rounded-full sm:w-auto"
                onClick={() => onAcceptSpaceInvite(inviteCode)}
                disabled={isAcceptingSpaceInvite}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Accept
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full rounded-full sm:w-auto"
                onClick={() => onDeclineSpaceInvite(notification.id)}
              >
                <X className="mr-1.5 h-4 w-4" />
                Decline
              </Button>
            </>
          )}
          {conversationId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
              onClick={() => onOpenConversation(conversationId)}
            >
              <MessageSquare className="mr-1.5 h-4 w-4" />
              Open Chat
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function PingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isJoinByCodeOpen, setIsJoinByCodeOpen] = useState(false);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [isRedeemingSpace, setIsRedeemingSpace] = useState(false);
  const { goBack, goTo } = useAppNavigation();
  const { tab } = useParams<{ tab?: string }>();
  const routeTab = isPingsTab(tab) ? tab : null;
  const {
    incoming,
    outgoing,
    isLoading,
    acceptPing,
    declinePing,
    cancelPing,
    blockUser,
    isAccepting,
    isDeclining,
    isCancelling,
    isBlocking,
  } = usePings();
  const { notifications, isLoading: isLoadingNotifications } = useNotifications();

  const handleAcceptSpaceInvite = async (code: string) => {
    setIsRedeemingSpace(true);
    try {
      const res = await spacesApi.redeemInvite(code);
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (res.status === 'joined') {
        toast.success('Successfully joined the space!');
      } else {
        toast.info('Join request submitted and pending approval!');
      }
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to join space'));
    } finally {
      setIsRedeemingSpace(false);
    }
  };

  const handleDeclineSpaceInvite = (notificationId: string) => {
    setDismissedNotificationIds((prev) => [...prev, notificationId]);
    toast.success('Invitation dismissed');
  };

  const visibleNotifications = notifications.filter((n) => !dismissedNotificationIds.includes(n.id));

  if (!routeTab) {
    return <Navigate to={APP_ROUTES.pingsTab('notifications')} replace />;
  }

  const pendingIncoming = incoming.filter((item) => item.ping.status === 'pending');
  const incomingHistory = incoming.filter((item) => item.ping.status !== 'pending');
  const pendingOutgoing = outgoing.filter((item) => item.ping.status === 'pending');
  const outgoingHistory = outgoing.filter((item) => item.ping.status !== 'pending');

  const handleClose = () => {
    goTo(APP_ROUTES.chat);
  };
  const handleBack = () => {
    goBack({
      fallback:
        routeTab !== 'notifications'
          ? APP_ROUTES.pingsTab('notifications')
          : APP_ROUTES.chat,
    });
  };

  const unreadNotifications = visibleNotifications.filter((n) => n.read_at === null).length;

  const matchedPingFor = (notification: NotificationView): PingItem | null => {
    const peerId =
      typeof notification.data?.peer_user_id === 'string'
        ? notification.data.peer_user_id
        : null;
    if (!peerId) return null;
    return (
      pendingIncoming.find((item) => item.peer.id === peerId) ?? null
    );
  };

  const handleTabChange = (value: PingsTab) => {
    navigate(APP_ROUTES.pingsTab(value));
  };

  const openChat = async (userId: string) => {
    try {
      const conversation = await conversationsApi.createOrGetDm(userId);
      navigate(APP_ROUTES.chatConversation(conversation.id));
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to open chat'));
    }
  };

  return (
    <PanelPageLayout
      title="Notifications"
      description="Your unified feed of connection events and message alerts, with quick actions."
      onBack={handleBack}
      onClose={handleClose}
      nav={
        <div className="flex flex-wrap items-center gap-2">
          {(['notifications', 'incoming', 'outgoing'] as const).map((value) => {
            const label =
              value === 'notifications'
                ? 'All'
                : value === 'incoming'
                  ? 'Incoming'
                  : 'Outgoing';
            const badgeCount =
              value === 'notifications'
                ? unreadNotifications
                : value === 'incoming'
                  ? pendingIncoming.length
                  : 0;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleTabChange(value)}
                className={cn(
                  'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  routeTab === value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {label}
                {badgeCount > 0 ? (
                  <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold">
                    {badgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto rounded-full"
            onClick={() => setIsJoinByCodeOpen(true)}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Join by code
          </Button>
        </div>
      }
      contentClassName="space-y-4"
    >
      <JoinByInviteDialog
        open={isJoinByCodeOpen}
        onOpenChange={setIsJoinByCodeOpen}
        onJoined={(conversationId) => navigate(APP_ROUTES.chatConversation(conversationId))}
      />
      {routeTab === 'notifications' ? (
        isLoadingNotifications ? (
          <PanelSection>
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
              <div className="text-sm text-muted-foreground">Loading notifications…</div>
            </div>
          </PanelSection>
        ) : visibleNotifications.length > 0 ? (
          <PanelSection title="Recent Notifications">
            <div className="space-y-3">
              {visibleNotifications.map((notification) => (
                <NotificationFeedItem
                  key={notification.id}
                  notification={notification}
                  matchedPing={matchedPingFor(notification)}
                  onAccept={(ping) => acceptPing(ping.ping.id).then(() => openChat(ping.peer.id))}
                  onDecline={(pingId) => declinePing(pingId)}
                  onOpenConversation={(conversationId) =>
                    navigate(APP_ROUTES.chatConversation(conversationId))
                  }
                  isAccepting={isAccepting}
                  isDeclining={isDeclining}
                  onAcceptSpaceInvite={handleAcceptSpaceInvite}
                  onDeclineSpaceInvite={handleDeclineSpaceInvite}
                  isAcceptingSpaceInvite={isRedeemingSpace}
                />
              ))}
            </div>
          </PanelSection>
        ) : (
          <EmptyState
            icon={<Bell className="h-8 w-8 text-muted-foreground" />}
            title="No notifications yet"
            description="Connection requests and message alerts will appear here."
          />
        )
      ) : isLoading ? (
        <PanelSection>
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
            <div className="text-sm text-muted-foreground">Loading ping activity…</div>
          </div>
        </PanelSection>
      ) : routeTab === 'incoming' ? (
        <>
          {pendingIncoming.length > 0 ? (
            <PanelSection
              title="Pending Incoming"
              description="Accept, decline, or block users before a conversation starts."
            >
              <div className="space-y-3">
                {pendingIncoming.map((item) => (
                  <PingPersonCard
                    key={item.ping.id}
                    item={item}
                    metaLabel={buildPingMetaLabel('Received', 'Recv', item.ping.created_at)}
                    actions={
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="w-full rounded-full sm:w-auto"
                          onClick={() => acceptPing(item.ping.id).then(() => openChat(item.peer.id))}
                          disabled={isAccepting}
                        >
                          <Check className="mr-1.5 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full rounded-full sm:w-auto"
                          onClick={() => declinePing(item.ping.id)}
                          disabled={isDeclining}
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          Decline
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
                          onClick={() => blockUser(item.peer.id)}
                          disabled={isBlocking}
                        >
                          <ShieldAlert className="mr-1.5 h-4 w-4" />
                          Block
                        </Button>
                      </>
                    }
                  />
                ))}
              </div>
            </PanelSection>
          ) : null}

          {incomingHistory.length > 0 ? (
            <PanelSection
              title="Recent Incoming Activity"
              description="Resolved ping requests remain visible here for quick context."
            >
              <div className="space-y-3">
                {incomingHistory.map((item) => (
                  <PingPersonCard
                    key={item.ping.id}
                    item={item}
                    metaLabel={buildPingMetaLabel('Updated', 'Upd', item.ping.updated_at)}
                    actions={
                      item.ping.status === 'accepted' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
                          onClick={() => openChat(item.peer.id)}
                        >
                          <MessageSquare className="mr-1.5 h-4 w-4" />
                          Open Chat
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </PanelSection>
          ) : null}

          {!pendingIncoming.length && !incomingHistory.length ? (
            <EmptyState
              icon={<Bell className="h-8 w-8 text-muted-foreground" />}
              title="No incoming pings"
              description="New requests will appear here when people want to start a chat."
            />
          ) : null}
        </>
      ) : (
        <>
          {pendingOutgoing.length > 0 ? (
            <PanelSection
              title="Pending Outgoing"
              description="These users have not responded yet. You can cancel any pending request."
            >
              <div className="space-y-3">
                {pendingOutgoing.map((item) => (
                  <PingPersonCard
                    key={item.ping.id}
                    item={item}
                    metaLabel={buildPingMetaLabel('Sent', 'Sent', item.ping.created_at)}
                    actions={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
                        onClick={() => cancelPing(item.ping.id)}
                        disabled={isCancelling}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Cancel
                      </Button>
                    }
                  />
                ))}
              </div>
            </PanelSection>
          ) : null}

          {outgoingHistory.length > 0 ? (
            <PanelSection
              title="Recent Outgoing Activity"
              description="Track accepted, declined, cancelled, or blocked requests."
            >
              <div className="space-y-3">
                {outgoingHistory.map((item) => (
                  <PingPersonCard
                    key={item.ping.id}
                    item={item}
                    metaLabel={buildPingMetaLabel('Updated', 'Upd', item.ping.updated_at)}
                    actions={
                      item.ping.status === 'accepted' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="col-span-2 w-full rounded-full sm:col-span-1 sm:w-auto"
                          onClick={() => openChat(item.peer.id)}
                        >
                          <MessageSquare className="mr-1.5 h-4 w-4" />
                          Open Chat
                        </Button>
                      ) : undefined
                    }
                  />
                ))}
              </div>
            </PanelSection>
          ) : null}

          {!pendingOutgoing.length && !outgoingHistory.length ? (
            <EmptyState
              icon={<UserPlus className="h-8 w-8 text-muted-foreground" />}
              title="No outgoing pings"
              description="Send a ping from chat discovery and it will appear here."
            />
          ) : null}
        </>
      )}
    </PanelPageLayout>
  );
}
