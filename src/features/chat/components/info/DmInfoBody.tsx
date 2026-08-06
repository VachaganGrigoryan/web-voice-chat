import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { usersApi } from '@/api/endpoints';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { PresenceDot, resolvePresenceState } from '@/components/presence/PresenceDot';

interface DmInfoBodyProps {
  peerUserId: string;
}

const formatLastSeen = (value?: string | null) => {
  if (!value) return null;
  const seen = new Date(value);
  if (Number.isNaN(seen.getTime())) return null;
  return `Last seen ${seen.toLocaleString()}`;
};

/**
 * The person on the other side of a direct message.
 *
 * Uses the profile page's query key so opening a peer whose profile was already
 * viewed paints from cache. `contact_details` is requested because it carries
 * the connection state the actions above this body gate on.
 */
export function DmInfoBody({ peerUserId }: DmInfoBodyProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user-profile', peerUserId],
    queryFn: () => usersApi.getUser(peerUserId, 'contact_details'),
    enabled: Boolean(peerUserId),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        This profile could not be loaded.
      </p>
    );
  }

  const name = user.display_name || user.username || peerUserId;
  const status = [user.status_emoji, user.status_text].filter(Boolean).join(' ');
  const lastSeen = user.is_online ? null : formatLastSeen(user.last_seen_at);

  return (
    <div className="space-y-3">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className="h-20 w-20 border">
            {user.avatar?.url ? (
              <AvatarImage src={user.avatar.url} alt={name} className="object-cover" />
            ) : null}
            <AvatarFallback className="text-xl">{(name[0] || '?').toUpperCase()}</AvatarFallback>
          </Avatar>
          <PresenceDot state={resolvePresenceState(user)} size="lg" anchored />
        </div>

        <div className="space-y-0.5 text-center">
          <div className="text-base font-semibold">{name}</div>
          {user.username ? (
            <div className="text-sm text-muted-foreground">@{user.username}</div>
          ) : null}
          {status ? <div className="text-sm">{status}</div> : null}
          <div className="text-xs text-muted-foreground">
            {user.is_online ? 'Online' : lastSeen ?? 'Offline'}
          </div>
        </div>
      </div>

      {user.bio ? (
        <p className="whitespace-pre-wrap break-words text-center text-sm text-muted-foreground">
          {user.bio}
        </p>
      ) : null}

      {user.pronouns || user.timezone ? (
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {user.pronouns ? <span>{user.pronouns}</span> : null}
          {user.timezone ? <span>{user.timezone}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
