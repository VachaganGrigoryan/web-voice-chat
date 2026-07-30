import { Hash, Loader2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
import { type FollowListMode, useFollowEntities } from '../people/useFollowEntities';

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: FollowListMode;
  relationships: Relationship[];
}

export function FollowListDialog({
  open,
  onOpenChange,
  mode,
  relationships,
}: FollowListDialogProps) {
  const navigate = useNavigate();
  const { targets, entities, isLoading } = useFollowEntities(mode, relationships, open);

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
