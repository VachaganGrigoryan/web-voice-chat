import { ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { APP_ROUTES, isPingsTab, PingsTab } from '@/app/routes';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { usePings } from '@/hooks/usePings';
import { PingItem } from '@/api/types';
import { cn } from '@/lib/utils';
import {
  Bell,
  Check,
  Loader2,
  MessageSquare,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';

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
  metaLabel: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="h-11 w-11 shrink-0 border">
          {item.peer.avatar ? <AvatarImage src={item.peer.avatar.url} className="object-cover" /> : null}
          <AvatarFallback>{(item.peer.display_name || item.peer.username || '?')[0].toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-1">
          <div className="truncate text-sm font-semibold">
            {item.peer.display_name || item.peer.username || 'Unknown User'}
          </div>
          {item.peer.username ? <div className="truncate text-xs text-muted-foreground">@{item.peer.username}</div> : null}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{metaLabel}</span>
            <span className="text-muted-foreground/50">•</span>
            <PingStatusBadge status={item.ping.status} />
          </div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
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

export default function PingsPage() {
  const navigate = useNavigate();
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

  if (!routeTab) {
    return <Navigate to={APP_ROUTES.pingsTab('incoming')} replace />;
  }

  const pendingIncoming = incoming.filter((item) => item.ping.status === 'pending');
  const incomingHistory = incoming.filter((item) => item.ping.status !== 'pending');
  const pendingOutgoing = outgoing.filter((item) => item.ping.status === 'pending');
  const outgoingHistory = outgoing.filter((item) => item.ping.status !== 'pending');

  const handleClose = () => {
    navigate(APP_ROUTES.chat);
  };
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (routeTab !== 'incoming') {
      navigate(APP_ROUTES.pingsTab('incoming'));
      return;
    }

    navigate(APP_ROUTES.chat);
  };

  const handleTabChange = (value: PingsTab) => {
    navigate(APP_ROUTES.pingsTab(value));
  };

  const openChat = (userId: string) => {
    navigate(APP_ROUTES.chatPeer(userId));
  };

  return (
    <PanelPageLayout
      title="Pings"
      description="Review incoming and outgoing connection requests with consistent actions and status handling."
      onBack={handleBack}
      onClose={handleClose}
      nav={
        <div className="flex flex-wrap gap-2">
          {(['incoming', 'outgoing'] as const).map((value) => (
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
              {value === 'incoming' ? 'Incoming' : 'Outgoing'}
              {value === 'incoming' && pendingIncoming.length > 0 ? (
                <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-[10px] font-bold">
                  {pendingIncoming.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      }
      contentClassName="space-y-4"
    >
      {isLoading ? (
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
                    metaLabel={`Received ${formatDistanceToNow(new Date(item.ping.created_at), { addSuffix: true })}`}
                    actions={
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-full"
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
                          className="rounded-full"
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
                          className="rounded-full"
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
                    metaLabel={`Updated ${formatDistanceToNow(new Date(item.ping.updated_at), { addSuffix: true })}`}
                    actions={
                      item.ping.status === 'accepted' ? (
                        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => openChat(item.peer.id)}>
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
                    metaLabel={`Sent ${formatDistanceToNow(new Date(item.ping.created_at), { addSuffix: true })}`}
                    actions={
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
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
                    metaLabel={`Updated ${formatDistanceToNow(new Date(item.ping.updated_at), { addSuffix: true })}`}
                    actions={
                      item.ping.status === 'accepted' ? (
                        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => openChat(item.peer.id)}>
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
