import { useQuery } from '@tanstack/react-query';
import { Navigate, useParams } from 'react-router-dom';
import { usersApi } from '@/api/endpoints';
import { getApiErrorStatus } from '@/api/errors';
import { User, UserSummary } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Loader2, Lock, ShieldOff, User as UserIcon, UserPlus } from 'lucide-react';
import { useAppNavigation } from '@/navigation/appNavigation';
import { usePings } from '@/hooks/usePings';

function getDisplayName(
  user?:
    | Pick<UserSummary, 'display_name' | 'username' | 'id'>
    | Pick<User, 'display_name' | 'username' | 'id'>
    | null
) {
  return user?.display_name || user?.username || user?.id || 'Unknown User';
}

function isUnavailableError(error: unknown) {
  return getApiErrorStatus(error) === 404;
}

function formatLastSeen(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

interface ProfileInfoItemProps {
  label: string;
  value: string;
  mono?: boolean;
}

function ProfileInfoItem({ label, value, mono = false }: ProfileInfoItemProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
      <dt className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</dt>
      <dd className={`mt-2 break-words text-sm font-medium text-foreground ${mono ? 'font-mono text-[13px]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

export default function ProfilePage() {
  const { goBack, goTo } = useAppNavigation();
  const { userId } = useParams<{ userId?: string }>();
  const { sendPing, blockUser, unblockUser, isSending, isBlocking, isUnblocking } = usePings();

  const {
    data: profile,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      return usersApi.getUser(userId!);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!userId) {
    return <Navigate to={APP_ROUTES.chat} replace />;
  }

  const displayName = getDisplayName(profile || null);
  const username = profile?.username || null;
  const avatarUrl = profile?.avatar?.url || null;
  const bio = profile?.bio || null;
  const infoUsername = username ? `@${username}` : 'Not provided';
  const infoDisplayName = profile?.display_name || 'Not provided';
  const relationship = profile?.relationship || null;
  const statusLabel = [profile?.status_emoji, profile?.status_text].filter(Boolean).join(' ');
  const lastSeenLabel = formatLastSeen(profile?.last_seen_at);
  const showUnavailableMessage = isUnavailableError(error);
  const showGenericError = !!error && !showUnavailableMessage;
  const isLimited = profile?.profile_visibility === 'limited';

  const handleSendPing = async () => {
    if (!profile) return;
    await sendPing(profile.id);
    await refetch();
  };

  const handleBlock = async () => {
    if (!profile) return;
    await blockUser(profile.id);
    await refetch();
  };

  const handleUnblock = async () => {
    if (!profile) return;
    await unblockUser(profile.id);
    await refetch();
  };

  return (
    <PanelPageLayout
      title="User Profile"
      description="Public profile details and identity information for this conversation partner."
      onBack={() => goBack({ fallback: APP_ROUTES.chat })}
      onClose={() => goTo(APP_ROUTES.chat)}
      contentClassName="scrollbar-hidden space-y-4"
    >
      <PanelSection title="Overview" description="Core public details visible from chat and direct links.">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
            {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
            <AvatarFallback className="bg-muted text-3xl">
              {displayName[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-3 pt-2 text-center sm:text-left">
            <div className="inline-flex rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
              {isLimited ? 'Limited profile' : relationship?.chat_allowed ? 'Contact' : 'Public profile'}
            </div>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{username ? `@${username}` : userId}</p>
            {statusLabel ? <p className="max-w-sm pt-2 text-sm text-foreground">{statusLabel}</p> : null}
            {relationship && !relationship.blocks_me ? (
              <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">
                {relationship.can_ping ? (
                  <Button type="button" size="sm" onClick={handleSendPing} disabled={isSending}>
                    {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Send ping
                  </Button>
                ) : null}
                {relationship.blocked_by_me ? (
                  <Button type="button" variant="outline" size="sm" onClick={handleUnblock} disabled={isUnblocking}>
                    {isUnblocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
                    Unblock
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={handleBlock} disabled={isBlocking}>
                    {isBlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                    Block
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </PanelSection>

      {isLoading && !profile ? (
        <PanelSection>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </PanelSection>
      ) : showUnavailableMessage ? (
        <PanelSection title="Unavailable">
          <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Profile is not available.</span>
          </div>
        </PanelSection>
      ) : showGenericError ? (
        <PanelSection title="Unavailable">
          <div className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm text-muted-foreground">
            <UserIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Failed to load profile.</span>
          </div>
        </PanelSection>
      ) : (
        <>
          <PanelSection
            title="Identity"
            description="Structured public identity details from this user profile."
            action={
              isFetching ? (
                <div className="flex items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Updating…
                </div>
              ) : null
            }
          >
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <ProfileInfoItem label="Username" value={infoUsername} />
              <ProfileInfoItem label="Display Name" value={infoDisplayName} />
              {profile?.pronouns ? <ProfileInfoItem label="Pronouns" value={profile.pronouns} /> : null}
              {profile?.timezone ? <ProfileInfoItem label="Timezone" value={profile.timezone} /> : null}
              {lastSeenLabel ? <ProfileInfoItem label="Last Seen" value={lastSeenLabel} /> : null}
              <ProfileInfoItem label="User ID" value={userId} mono />
            </dl>
          </PanelSection>

          <PanelSection title="About" description="Short personal details shared through the messaging system.">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 sm:p-5">
              {isLimited ? (
                <div className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Private profile details are hidden.</span>
                </div>
              ) : bio ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No bio provided.</p>
              )}
            </div>
          </PanelSection>
        </>
      )}
    </PanelPageLayout>
  );
}
