import { useQueries } from '@tanstack/react-query';
import { Hash, Loader2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { channelsApi, usersApi } from '@/api/endpoints';
import type { Relationship } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

type FollowListMode = 'followers' | 'following';

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FollowListMode;
  relationships: Relationship[];
}

interface FollowListTarget {
  kind: 'user' | 'channel';
  id: string;
}

interface FollowListEntity {
  kind: 'user' | 'channel';
  id: string;
  label: string;
  secondary: string | null;
  avatarUrl: string | null;
}

function resolveTarget(
  mode: FollowListMode,
  relationship: Relationship
): FollowListTarget | null {
  if (mode === 'followers') {
    return { kind: 'user', id: relationship.user_id };
  }
  if (relationship.target_type === 'user' || relationship.target_type === 'channel') {
    return { kind: relationship.target_type, id: relationship.target_id };
  }
  return null;
}

async function loadEntity(target: FollowListTarget): Promise<FollowListEntity> {
  if (target.kind === 'channel') {
    const channel = await channelsApi.get(target.id);
    return {
      kind: 'channel',
      id: channel.id,
      label: channel.name,
      secondary: `#${channel.slug}`,
      avatarUrl: channel.avatar?.url ?? null,
    };
  }

  const user = await usersApi.getUser(target.id);
  return {
    kind: 'user',
    id: user.id,
    label: user.display_name || user.username || user.id,
    secondary: user.username ? `@${user.username}` : null,
    avatarUrl: user.avatar?.url ?? null,
  };
}

export function FollowListDialog({
  open,
  onOpenChange,
  mode,
  relationships,
}: FollowListDialogProps) {
  const navigate = useNavigate();
  const targets = relationships
    .filter((relationship) => relationship.status === 'active')
    .map((relationship) => resolveTarget(mode, relationship))
    .filter((target): target is FollowListTarget => target !== null);
  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ['follow-entity', target.kind, target.id],
      queryFn: () => loadEntity(target),
      enabled: open,
    })),
  });
  const isLoading = queries.some((query) => query.isLoading);
  const entities = queries.flatMap((query) => (query.data ? [query.data] : []));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'followers' ? 'Followers' : 'Following'}</DialogTitle>
          <DialogDescription>
            {targets.length} active {targets.length === 1 ? 'relationship' : 'relationships'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entities.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing to show yet.
          </p>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {entities.map((entity) => (
              <button
                key={`${entity.kind}:${entity.id}`}
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-muted/60"
                onClick={() => {
                  onOpenChange(false);
                  navigate(
                    entity.kind === 'user'
                      ? APP_ROUTES.profile(entity.id)
                      : APP_ROUTES.channel(entity.id)
                  );
                }}
              >
                <Avatar className="h-9 w-9">
                  {entity.avatarUrl ? <AvatarImage src={entity.avatarUrl} alt={entity.label} /> : null}
                  <AvatarFallback>
                    {entity.kind === 'channel' ? (
                      <Hash className="h-4 w-4" />
                    ) : (
                      <UserRound className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{entity.label}</span>
                  {entity.secondary ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {entity.secondary}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
