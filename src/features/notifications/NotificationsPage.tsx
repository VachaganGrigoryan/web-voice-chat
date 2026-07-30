import { ReactNode, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES, ActivityTab } from '@/app/routes';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { PageTabs } from '@/components/page/PageTabs';
import { PageTab } from '@/components/page/pageTypes';
import { useConnections } from '@/hooks/useConnections';
import { useNotifications } from '@/hooks/useNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { ConnectionListItem, NotificationView } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { cn } from '@/lib/utils';
import { useAppNavigation } from '@/navigation/appNavigation';
import { toast } from 'sonner';
import {
  AtSign,
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
    <div className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center hover:bg-muted/30 transition-colors">
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
        'flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center transition-colors',
        isUnread ? 'cursor-pointer bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
      )}
    >
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
          : tab === 'call-logs'
            ? 'call-logs'
            : 'all';

  const mentionNotifications = notifications.filter(
    (item) => item.kind === 'message_mention' || item.kind === 'message_reply'
  );
  const visibleNotifications = currentTab === 'mentions' ? mentionNotifications : notifications;

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

  const pendingIncomingCount = incoming.filter((item) => item.relationship.status === 'pending').length;

  const tabs: readonly PageTab[] = [
    { id: 'all', label: 'All', icon: Bell, count: unreadCount },
    { id: 'mentions', label: 'Mentions', icon: AtSign, count: mentionNotifications.length },
    { id: 'requests', label: 'Requests', icon: UserPlus, count: pendingIncomingCount },
    { id: 'sent', label: 'Sent', icon: Send, count: 0 },
    { id: 'call-logs', label: 'Call Logs', icon: PhoneCall },
  ];

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title="Activity"
        description="Alerts, mentions, space invitations, connection requests and call logs"
        tabs={
          <PageTabs
            tabs={tabs}
            activeTabId={currentTab}
            onSelect={(tabId) => navigate(APP_ROUTES.activityTab(tabId as ActivityTab))}
            aria-label="Activity sections"
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

      <PageBody>
        {(currentTab === 'all' || currentTab === 'mentions') && (
          <PanelSection
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
            ) : visibleNotifications.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Bell className="mx-auto h-10 w-10 mb-3 opacity-40 text-brand" />
                <p className="font-medium text-foreground">
                  {currentTab === 'mentions' ? 'No mentions yet' : 'No notifications yet'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y rounded-2xl border bg-card/60">
                {visibleNotifications.map((notification) => (
                  <EnhancedNotificationRowLayout
                    key={notification.id}
                    notification={notification}
                    onOpenSpaceRequest={(spaceId) => navigate(APP_ROUTES.spaceDetail(spaceId))}
                    onOpenConversation={(convId) => goTo(APP_ROUTES.chatConversation(convId))}
                    onOpenPost={(channelId, postId) =>
                      navigate(APP_ROUTES.channelPost(channelId, postId))
                    }
                    onMarkRead={markRead}
                  />
                ))}
              </div>
            )}
          </PanelSection>
        )}

        {currentTab === 'call-logs' ? <CallLogsTab /> : null}

        {currentTab === 'requests' && (
          <PanelSection
            title="Incoming Connection Requests"
            description="People who want to connect with you on Vogi."
          >
            {isLoadingConnections ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                Loading incoming requests…
              </div>
            ) : incoming.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <UserPlus className="mx-auto h-10 w-10 mb-3 opacity-40 text-primary" />
                <p className="font-medium text-foreground">No pending connection requests</p>
              </div>
            ) : (
              <div className="divide-y rounded-2xl border bg-card/60">
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
          </PanelSection>
        )}

        {currentTab === 'sent' && (
          <PanelSection
            title="Sent Connection Requests"
            description="Connection requests you have sent to other users."
          >
            {isLoadingConnections ? (
              <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
                Loading sent requests…
              </div>
            ) : outgoing.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <p className="font-medium text-foreground">No sent requests</p>
              </div>
            ) : (
              <div className="divide-y rounded-2xl border bg-card/60">
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
          </PanelSection>
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
