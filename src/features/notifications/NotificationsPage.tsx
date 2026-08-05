import { ReactNode, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES, ActivityTab } from '@/app/routes';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { PageTab } from '@/components/page/pageTypes';
import { useConnections } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { useCallHistory } from '@/hooks/useCallHistory';
import { useQueryClient } from '@tanstack/react-query';
import { ConnectionListItem, NotificationView } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { cn } from '@/lib/utils';
import { useAppNavigation } from '@/navigation/appNavigation';
import { toast } from 'sonner';
import {
  AtSign,
  BarChart3,
  Bell,
  Check,
  CheckCheck,
  Globe,
  KeyRound,
  Loader2,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import { JoinByInviteDialog } from '@/features/chat/components/JoinByInviteDialog';
import { CallLogsTab } from './CallLogsTab';
import {
  ActivityEmptyState,
  ActivityLensBar,
  ActivitySection,
  ActivitySignalOverview,
} from './ActivitySignalConsole';
import { buildActivityInsights } from './activityInsights';

type PingMetaLabel = {
  desktop: string;
  mobile: string;
};

function formatCompactRelative(date: Date) {
  const diffMs = Math.max(Date.now() - date.getTime(), 0);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;

  const years = Math.floor(days / 365);
  return `${years}y`;
}

function buildMetaLabel(desktopPrefix: string, mobilePrefix: string, value: string): PingMetaLabel {
  const date = new Date(value);
  return {
    desktop: `${desktopPrefix} ${formatDistanceToNow(date, { addSuffix: true })}`,
    mobile: `${mobilePrefix} ${formatCompactRelative(date)}`,
  };
}

function PingStatusBadge({ status }: { status: ConnectionListItem['relationship']['status'] }) {
  const badgeClassName =
    status === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300'
      : status === 'declined'
        ? 'border-destructive/20 bg-destructive/10 text-destructive'
        : status === 'revoked'
          ? 'border-muted-foreground/20 bg-muted text-muted-foreground'
          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300';
  const label =
    status === 'active'
      ? 'Connected'
      : status === 'declined'
        ? 'Declined'
        : status === 'revoked'
          ? 'Cancelled'
          : 'Pending';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        badgeClassName
      )}
    >
      {label}
    </span>
  );
}

function ConnectionRowLayout({
  item,
  meta,
  badge,
  actions,
}: {
  item: ConnectionListItem;
  meta: PingMetaLabel;
  badge?: ReactNode;
  actions?: ReactNode;
}) {
  const label = item.peer.display_name || item.peer.username || item.peer.id;
  const username = item.peer.username ? `@${item.peer.username}` : null;
  const initial = (label[0] || '?').toUpperCase();

  return (
    <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-e1 transition-colors duration-200 hover:border-brand/30 hover:bg-brand-muted/35 sm:flex-row sm:items-center motion-reduce:transition-none">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-10 w-10 shrink-0 border border-border/50">
          {item.peer.avatar?.url ? <AvatarImage src={item.peer.avatar.url} /> : null}
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{label}</span>
            {username && <span className="text-xs text-muted-foreground">{username}</span>}
            {badge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="hidden sm:inline">{meta.desktop}</span>
            <span className="sm:hidden">{meta.mobile}</span>
          </p>
        </div>
      </div>
      {actions ? <div className="flex w-full items-center justify-end gap-2 sm:w-auto">{actions}</div> : null}
    </div>
  );
}

function EnhancedNotificationRowLayout({
  notification,
  onOpenSpaceRequest,
  onOpenConversation,
  onOpenPost,
  onMarkRead,
}: {
  notification: NotificationView;
  onOpenSpaceRequest?: (spaceId: string) => void;
  onOpenConversation?: (conversationId: string) => void;
  onOpenPost?: (channelId: string, postId: string) => void;
  onMarkRead?: (notificationId: string) => void;
}) {
  const meta = buildMetaLabel('Received', 'Rec.', notification.created_at);
  const isUnread = !notification.read_at;

  const actorName = (notification.data?.actor_name as string) || (notification.data?.user_name as string) || null;
  const actorAvatar = (notification.data?.actor_avatar as string) || null;
  const spaceId = (notification.data?.space_id as string) || (notification.resource_type === 'space' ? notification.resource_id : undefined);
  const conversationId = (notification.data?.conversation_id as string) || (notification.resource_type === 'conversation' ? notification.resource_id : undefined);
  const spaceName = (notification.data?.space_name as string) || null;
  // Comment/thread-reply notifications carry the comment message's own id;
  // PostDetailPage resolves it to the thread root on load.
  const channelPostId =
    notification.resource_type === 'channel' && notification.message_id
      ? notification.message_id
      : undefined;

  const getKindConfig = () => {
    switch (notification.kind) {
      case 'message_mention':
      case 'message_reply':
        return {
          icon: AtSign,
          badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900',
          title: actorName ? `${actorName} mentioned you` : 'New mention',
          defaultBody: 'You were mentioned in a conversation',
        };
      case 'space_join_request':
      case 'space_invite':
        return {
          icon: Globe,
          badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900',
          title: spaceName ? `Space Invite: ${spaceName}` : 'Space Request',
          defaultBody: actorName ? `${actorName} requested to join the space` : 'New space join request',
        };
      case 'space_role_granted':
        return {
          icon: KeyRound,
          badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900',
          title: 'Role Granted',
          defaultBody: 'Your space permissions have been updated',
        };
      case 'relationship_request':
      case 'ping':
        return {
          icon: UserPlus,
          badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900',
          title: actorName ? `${actorName} sent a connection request` : 'New connection request',
          defaultBody: 'Wants to connect with you',
        };
      case 'comment':
      case 'comment_reply':
      case 'thread_reply':
        return {
          icon: MessageSquare,
          badgeBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900',
          title: actorName ? `${actorName} commented on your post` : 'New comment',
          defaultBody: 'Someone commented on your post',
        };
      case 'security_alert':
        return {
          icon: ShieldAlert,
          badgeBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900',
          title: 'Security Alert',
          defaultBody: 'New sign-in or security update detected',
        };
      default:
        return {
          icon: Bell,
          badgeBg: 'bg-muted text-muted-foreground border-border',
          title: 'Notification',
          defaultBody: 'Activity update',
        };
    }
  };

  const config = getKindConfig();
  const Icon = config.icon;
  const title = (notification.data?.title as string) || config.title;
  const body = (notification.data?.body as string) || (notification.data?.message as string) || config.defaultBody;

  return (
    <div
      onClick={isUnread && onMarkRead ? () => onMarkRead(notification.id) : undefined}
      className={cn(
        'relative flex flex-col items-start justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-e1 transition-colors duration-200 sm:flex-row sm:items-center motion-reduce:transition-none',
        isUnread
          ? 'cursor-pointer border-brand/30 bg-brand-muted/55 hover:bg-brand-muted'
          : 'border-border/70 bg-card hover:border-brand/25 hover:bg-muted/25'
      )}
    >
      <span
        className={cn(
          'absolute inset-y-3 left-0 w-1 rounded-r-full',
          isUnread ? 'bg-brand' : 'bg-border'
        )}
      />
      <div className="flex min-w-0 items-start gap-3">
        {/* Actor Avatar or Icon Badge */}
        <div className="relative shrink-0 mt-0.5">
          {actorAvatar ? (
            <Avatar className="h-10 w-10 border border-border/50">
              <AvatarImage src={actorAvatar} />
              <AvatarFallback>{(actorName || '?')[0].toUpperCase()}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl border', config.badgeBg)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          {actorAvatar ? (
            <span className={cn('absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background', config.badgeBg)}>
              <Icon className="h-3 w-3" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground text-sm">{title}</span>
            {spaceName && (
              <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {spaceName}
              </span>
            )}
            {isUnread && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                New
              </span>
            )}
          </div>
          {body ? <p className="text-sm text-foreground/80 leading-relaxed">{body}</p> : null}
          <p className="text-xs text-muted-foreground">
            <span className="hidden sm:inline">{meta.desktop}</span>
            <span className="sm:hidden">{meta.mobile}</span>
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex w-full items-center justify-end gap-2 sm:w-auto shrink-0">
        {spaceId && onOpenSpaceRequest ? (
          <Button
            size="sm"
            onClick={() => onOpenSpaceRequest(spaceId)}
          >
            Review Request
          </Button>
        ) : null}
        {conversationId && onOpenConversation ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenConversation(conversationId)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
        ) : null}
        {channelPostId && onOpenPost ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenPost(notification.resource_id, channelPostId)}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            View post
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function notificationGroupLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((today - day) / (24 * 60 * 60 * 1000));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function groupNotifications(notifications: readonly NotificationView[]) {
  const groups = new Map<string, NotificationView[]>();
  for (const notification of notifications) {
    const label = notificationGroupLabel(notification.created_at);
    groups.set(label, [...(groups.get(label) ?? []), notification]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

function NotificationTimeline({
  notifications,
  emptyTitle,
  emptyDescription,
  onOpenSpaceRequest,
  onOpenConversation,
  onOpenPost,
  onMarkRead,
}: {
  notifications: readonly NotificationView[];
  emptyTitle: string;
  emptyDescription: string;
  onOpenSpaceRequest: (spaceId: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenPost: (channelId: string, postId: string) => void;
  onMarkRead: (notificationId: string) => void;
}) {
  const groups = groupNotifications(notifications);

  if (notifications.length === 0) {
    return <ActivityEmptyState icon={Bell} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.label} className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group.label}
            </h3>
            <span className="h-px flex-1 bg-border/70" />
            <span className="text-xs font-medium text-muted-foreground">
              {group.items.length} signal{group.items.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid gap-2">
            {group.items.map((notification) => (
              <EnhancedNotificationRowLayout
                key={notification.id}
                notification={notification}
                onOpenSpaceRequest={onOpenSpaceRequest}
                onOpenConversation={onOpenConversation}
                onOpenPost={onOpenPost}
                onMarkRead={onMarkRead}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function NotificationsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { goTo } = useAppNavigation();

  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const {
    incoming,
    outgoing,
    isLoading: isLoadingConnections,
    acceptPing,
    declinePing,
    cancelPing,
    isAccepting,
    isDeclining,
    isCancelling,
  } = useConnections();

  const {
    notifications,
    isLoading: isLoadingNotifications,
    unreadCount,
    markRead,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications();

  // Tab mapping. The legacy /notifications and /pings aliases feed the same tabs
  // as /activity, so old links keep working.
  const currentTab: ActivityTab =
    tab === 'requests' || tab === 'incoming'
      ? 'requests'
      : tab === 'sent' || tab === 'outgoing'
        ? 'sent'
        : tab === 'mentions'
          ? 'mentions'
          : tab === 'stats'
            ? 'stats'
            : tab === 'call-logs'
              ? 'call-logs'
            : 'all';
  const shouldLoadCallHistory = currentTab === 'stats' || currentTab === 'call-logs';
  const callHistoryState = useCallHistory({ enabled: shouldLoadCallHistory });

  const mentionNotifications = notifications.filter(
    (item) => item.kind === 'message_mention' || item.kind === 'message_reply'
  );
  const visibleNotifications = currentTab === 'mentions' ? mentionNotifications : notifications;
  const pendingIncomingCount = incoming.filter((item) => item.relationship.status === 'pending').length;
  const pendingOutgoingCount = outgoing.filter((item) => item.relationship.status === 'pending').length;
  const insights = useMemo(
    () =>
      buildActivityInsights({
        notifications,
        incoming,
        outgoing,
        callHistory: callHistoryState.history,
        unreadCount,
      }),
    [callHistoryState.history, incoming, notifications, outgoing, unreadCount]
  );

  const handleOpenConversation = (peerUserId: string) => {
    goTo(APP_ROUTES.chatConversation(peerUserId));
  };

  const handleAccept = async (peerUserId: string) => {
    setActionUserId(peerUserId);
    try {
      await acceptPing(peerUserId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversations'] }),
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
      ]);
      toast.success('Connection accepted');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to accept connection'));
    } finally {
      setActionUserId(null);
    }
  };

  const handleDecline = async (peerUserId: string) => {
    setActionUserId(peerUserId);
    try {
      await declinePing(peerUserId);
      toast.success('Connection declined');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to decline connection'));
    } finally {
      setActionUserId(null);
    }
  };

  const handleCancel = async (peerUserId: string) => {
    setActionUserId(peerUserId);
    try {
      await cancelPing(peerUserId);
      toast.success('Connection request cancelled');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to cancel connection'));
    } finally {
      setActionUserId(null);
    }
  };

  const tabs: readonly PageTab[] = [
    { id: 'all', label: 'All', icon: Bell, count: unreadCount },
    { id: 'stats', label: 'Stats', icon: BarChart3, count: currentTab === 'stats' ? insights.loadedSignals : undefined },
    { id: 'mentions', label: 'Mentions', icon: AtSign, count: mentionNotifications.length },
    { id: 'requests', label: 'Requests', icon: UserPlus, count: pendingIncomingCount },
    { id: 'sent', label: 'Sent', icon: Send, count: pendingOutgoingCount },
    { id: 'call-logs', label: 'Call Logs', icon: PhoneCall, count: shouldLoadCallHistory ? callHistoryState.history.length : undefined },
  ];
  const isInsightLoading =
    isLoadingNotifications || isLoadingConnections || callHistoryState.isLoading;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title="Activity"
        description="Signals, requests, mentions and calls"
        tabs={
          <ActivityLensBar
            tabs={tabs}
            activeTabId={currentTab}
            onSelect={(tabId) => navigate(APP_ROUTES.activityTab(tabId as ActivityTab))}
          />
        }
        primaryAction={{
          id: 'join-code',
          label: 'Join with code',
          icon: KeyRound,
          onSelect: () => setInviteDialogOpen(true),
        }}
        secondaryActions={[
          {
            id: 'mark-all-read',
            label: 'Mark all read',
            icon: isMarkingAllRead ? Loader2 : CheckCheck,
            onSelect: () => markAllRead(),
            disabled: isMarkingAllRead || unreadCount === 0,
          },
          {
            id: 'refresh',
            label: 'Refresh activity',
            icon: RefreshCw,
            onSelect: () => {
              void queryClient.invalidateQueries({ queryKey: ['notifications'] });
              void queryClient.invalidateQueries({ queryKey: ['connections'] });
              void queryClient.invalidateQueries({ queryKey: ['calls', 'history'] });
            },
          },
        ]}
        overflowActions={[
          {
            id: 'notification-settings',
            label: 'Notification settings',
            icon: Settings,
            onSelect: () => navigate(APP_ROUTES.settingsTab('notifications')),
          },
        ]}
      />

      <PageBody className="space-y-6">
        {currentTab === 'stats' ? (
          <ActivitySection
            title="Activity Stats"
            description="Real signals derived from loaded notifications, connection requests and call history."
          >
            <ActivitySignalOverview snapshot={insights} isLoading={isInsightLoading} />
          </ActivitySection>
        ) : null}

        {(currentTab === 'all' || currentTab === 'mentions') && (
          <ActivitySection
            title={currentTab === 'mentions' ? 'Mentions & replies' : 'Activity & notifications'}
            description={
              currentTab === 'mentions'
                ? 'Messages where someone mentioned you or replied to you.'
                : 'System alerts, space invitations, role updates, and mentions.'
            }
          >
            {isLoadingNotifications ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-brand" />
                Loading notifications…
              </div>
            ) : (
              <NotificationTimeline
                notifications={visibleNotifications}
                emptyTitle={currentTab === 'mentions' ? 'No mentions yet' : 'No notifications yet'}
                emptyDescription="You're all caught up."
                onOpenSpaceRequest={(spaceId) => navigate(APP_ROUTES.spaceDetail(spaceId))}
                onOpenConversation={(convId) => goTo(APP_ROUTES.chatConversation(convId))}
                onOpenPost={(channelId, postId) => navigate(APP_ROUTES.channelPost(channelId, postId))}
                onMarkRead={markRead}
              />
            )}
          </ActivitySection>
        )}

        {currentTab === 'call-logs' ? <CallLogsTab state={callHistoryState} /> : null}

        {currentTab === 'requests' && (
          <ActivitySection
            title="Incoming Connection Requests"
            description="People who want to connect with you on Vogi."
          >
            {isLoadingConnections ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                Loading incoming requests…
              </div>
            ) : incoming.length === 0 ? (
              <ActivityEmptyState icon={UserPlus} title="No pending connection requests" />
            ) : (
              <div className="grid gap-2">
                {incoming.map((item) => {
                  const isBusy = actionUserId === item.peer.id;
                  const isPending = item.relationship.status === 'pending';
                  const meta = buildMetaLabel('Received', 'Rec.', item.relationship.updated_at);

                  return (
                    <ConnectionRowLayout
                      key={item.peer.id}
                      item={item}
                      meta={meta}
                      badge={<PingStatusBadge status={item.relationship.status} />}
                      actions={
                        isPending ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAccept(item.peer.id)}
                              disabled={isBusy && (isAccepting || isDeclining)}
                            >
                              {isBusy && isAccepting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                              <span className="ml-1 hidden sm:inline">Accept</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDecline(item.peer.id)}
                              disabled={isBusy && (isAccepting || isDeclining)}
                            >
                              {isBusy && isDeclining ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <X className="h-4 w-4" />
                              )}
                              <span className="ml-1 hidden sm:inline">Decline</span>
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenConversation(item.peer.id)}
                          >
                            <MessageSquare className="mr-1 h-4 w-4" />
                            Message
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </ActivitySection>
        )}

        {currentTab === 'sent' && (
          <ActivitySection
            title="Sent Connection Requests"
            description="Connection requests you have sent to other users."
          >
            {isLoadingConnections ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                Loading sent requests…
              </div>
            ) : outgoing.length === 0 ? (
              <ActivityEmptyState icon={Send} title="No sent requests" />
            ) : (
              <div className="grid gap-2">
                {outgoing.map((item) => {
                  const isBusy = actionUserId === item.peer.id;
                  const isPending = item.relationship.status === 'pending';
                  const meta = buildMetaLabel('Sent', 'Sent', item.relationship.updated_at);

                  return (
                    <ConnectionRowLayout
                      key={item.peer.id}
                      item={item}
                      meta={meta}
                      badge={<PingStatusBadge status={item.relationship.status} />}
                      actions={
                        isPending ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancel(item.peer.id)}
                            disabled={isBusy && isCancelling}
                          >
                            {isBusy && isCancelling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            <span className="ml-1 hidden sm:inline">Cancel</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleOpenConversation(item.peer.id)}
                          >
                            <MessageSquare className="mr-1 h-4 w-4" />
                            Message
                          </Button>
                        )
                      }
                    />
                  );
                })}
              </div>
            )}
          </ActivitySection>
        )}
      </PageBody>

      <JoinByInviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onJoined={(conversationId) => navigate(APP_ROUTES.chatConversation(conversationId))}
      />
    </div>
  );
}

// Re-export PingsPage for backward compatibility
export const PingsPage = NotificationsPage;
