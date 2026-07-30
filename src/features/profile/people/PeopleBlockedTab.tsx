import { useQuery } from '@tanstack/react-query';
import { Loader2, UserRound } from 'lucide-react';

import { blocksApi } from '@/api/endpoints';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useConnections } from '@/hooks/useConnections';

/**
 * Blocked users. Previously reachable only through the privacy settings tab, which
 * is a poor home for a list of people.
 */
export function PeopleBlockedTab() {
  const { unblockUser, isUnblocking } = useConnections();
  const { data, isLoading } = useQuery({
    queryKey: ['blocks'],
    queryFn: () => blocksApi.list(),
  });

  const blocked = data?.data ?? [];

  return (
    <PanelSection
      title="Blocked"
      description={blocked.length ? `${blocked.length} blocked` : undefined}
    >
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : blocked.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          You have not blocked anyone.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {blocked.map((item) => {
            const name = item.user.display_name || item.user.username || item.user.id;
            return (
              <div key={item.user.id} className="flex items-center gap-3 p-4">
                <Avatar className="h-10 w-10 border border-border/60">
                  {item.user.avatar?.url ? (
                    <AvatarImage src={item.user.avatar.url} alt={name} />
                  ) : null}
                  <AvatarFallback>
                    <UserRound className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{name}</div>
                  {item.user.username ? (
                    <div className="truncate text-xs text-muted-foreground">
                      @{item.user.username}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  disabled={isUnblocking}
                  onClick={() => void unblockUser(item.user.id)}
                >
                  Unblock
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </PanelSection>
  );
}
