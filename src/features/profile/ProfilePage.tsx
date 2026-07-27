import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Lock, MessageCircle, ShieldOff, UserPlus } from 'lucide-react';

import { usersApi } from '@/api/endpoints';
import { getApiErrorStatus } from '@/api/errors';
import { User, UserSummary } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { FollowButton } from '@/components/FollowButton';
import { useConnections } from '@/hooks/useConnections';

import { ProfilePageShell, type ProfileDetailItem } from './components/ProfilePageShell';

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

function ProfileMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6">
      <div className="rounded-2xl border border-border bg-muted/40 px-6 py-8 text-center text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { sendPing, blockUser, unblockUser, isSending, isBlocking, isUnblocking } = useConnections();

  const {
    data: profile,
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => usersApi.getUser(userId!, 'contact_details'),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!userId) {
    return <Navigate to={APP_ROUTES.chat} replace />;
  }

  if (isLoading && !profile) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isUnavailableError(error)) {
    return <ProfileMessage>Profile is not available.</ProfileMessage>;
  }
  if (error) {
    return <ProfileMessage>Failed to load profile.</ProfileMessage>;
  }

  const displayName = getDisplayName(profile || null);
  const username = profile?.username ? `@${profile.username}` : null;
  const avatarUrl = profile?.avatar?.url || null;
  const bio = profile?.bio || null;
  const statusLabel = [profile?.status_emoji, profile?.status_text].filter(Boolean).join(' ') || null;
  const relationship = profile?.relationship || null;
  const conversationId = profile?.conversation_id || null;
  const lastSeenLabel = formatLastSeen(profile?.last_seen_at);

  const details: ProfileDetailItem[] = [
    { label: 'Username', value: username ?? 'Not provided' },
    { label: 'Display name', value: profile?.display_name || 'Not provided' },
    ...(profile?.pronouns ? [{ label: 'Pronouns', value: profile.pronouns }] : []),
    ...(profile?.timezone ? [{ label: 'Timezone', value: profile.timezone }] : []),
    ...(lastSeenLabel ? [{ label: 'Last seen', value: lastSeenLabel }] : []),
  ];

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

  const headerActions =
    relationship && !relationship.blocks_me ? (
      <>
        <FollowButton targetType="user" targetId={userId} />
        {conversationId ? (
          <Button
            type="button"
            size="sm"
            onClick={() => navigate(APP_ROUTES.chatConversation(conversationId))}
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Message
          </Button>
        ) : null}
        {relationship.can_ping ? (
          <Button type="button" size="sm" onClick={handleSendPing} disabled={isSending}>
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Send ping
          </Button>
        ) : null}
        {relationship.blocked_by_me ? (
          <Button type="button" variant="outline" size="sm" onClick={handleUnblock} disabled={isUnblocking}>
            {isUnblocking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="mr-2 h-4 w-4" />
            )}
            Unblock
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={handleBlock} disabled={isBlocking}>
            {isBlocking ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Block
          </Button>
        )}
      </>
    ) : null;

  return (
    <ProfilePageShell
      isOwner={false}
      userId={userId}
      displayName={displayName}
      username={username}
      avatarUrl={avatarUrl}
      bio={bio}
      statusLabel={statusLabel}
      details={details}
      headerActions={headerActions}
    />
  );
}
