import { useNavigate } from 'react-router-dom';
import { Hash, Loader2, UserRound } from 'lucide-react';

import { APP_ROUTES } from '@/app/routes';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { useFollowingRelationships } from '@/hooks/useFollowRelationships';
import { useAuthStore } from '@/store/authStore';
import { useFollowEntities } from './useFollowEntities';

/** Everything the viewer follows — both people and channels, in one list. */
export function PeopleFollowingTab() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.userId);
  const { data: relationships = [], isLoading: isLoadingRelationships } =
    useFollowingRelationships(currentUserId);
  const { entities, isLoading: isLoadingEntities } = useFollowEntities(
    'following',
    relationships
  );

  const isLoading = isLoadingRelationships || isLoadingEntities;

  return (
    <PanelSection
      title="Following"
      description={entities.length ? `${entities.length} followed` : undefined}
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          You are not following anyone yet.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {entities.map((entity) => (
            <button
              key={`${entity.kind}:${entity.id}`}
              type="button"
              onClick={() =>
                navigate(
                  entity.kind === 'user'
                    ? APP_ROUTES.profile(entity.id)
                    : APP_ROUTES.channel(entity.id)
                )
              }
              className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <Avatar className="h-10 w-10 border border-border/60">
                {entity.avatarUrl ? (
                  <AvatarImage src={entity.avatarUrl} alt={entity.label} />
                ) : null}
                <AvatarFallback>
                  {entity.kind === 'channel' ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
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
    </PanelSection>
  );
}
