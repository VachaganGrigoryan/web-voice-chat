import { Crown, Loader2, UserRound, X } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ManageMemberRow {
  readonly id: string;
  readonly userId: string;
  readonly roleLabel?: string | null;
  readonly isOwner?: boolean;
  readonly isSelf?: boolean;
}

interface RoleSelectConfig {
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly valueFor: (member: ManageMemberRow) => string;
  readonly onChange: (member: ManageMemberRow, value: string) => void;
  readonly isUpdating?: boolean;
}

interface MembersSectionProps {
  members: readonly ManageMemberRow[];
  isLoading: boolean;
  emptyLabel?: string;
  roleSelect?: RoleSelectConfig;
  onRemove?: (member: ManageMemberRow) => void;
  isRemoving?: boolean;
}

/**
 * Members for whichever resource is open. The row shape is normalized by the
 * caller from a channel/conversation/space-specific list — user profiles
 * aren't resolved for relationship-backed lists yet (tracked separately), so
 * a member shows its id, matching every other member list in the app today.
 */
export function MembersSection({
  members,
  isLoading,
  emptyLabel = 'No members yet.',
  roleSelect,
  onRemove,
  isRemoving,
}: MembersSectionProps) {
  return (
    <PanelSection title="Members" description={members.length ? `${members.length} members` : undefined}>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 p-4">
              <Avatar className="h-9 w-9 border border-border/60">
                <AvatarFallback>
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">
                {member.userId}
                {member.isSelf ? <span className="text-muted-foreground"> (you)</span> : null}
              </span>
              {member.isOwner ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-muted px-2 py-0.5 text-3xs font-semibold uppercase tracking-wide text-brand">
                  <Crown className="h-3 w-3" />
                  Owner
                </span>
              ) : roleSelect ? (
                <select
                  value={roleSelect.valueFor(member)}
                  disabled={roleSelect.isUpdating}
                  onChange={(event) => roleSelect.onChange(member, event.target.value)}
                  className={cn(
                    'rounded-lg border border-border bg-background px-2 py-1 text-xs',
                    roleSelect.isUpdating && 'opacity-60'
                  )}
                >
                  {roleSelect.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : member.roleLabel ? (
                <span className="text-xs font-medium text-muted-foreground">{member.roleLabel}</span>
              ) : null}
              {onRemove && !member.isOwner && !member.isSelf ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  disabled={isRemoving}
                  aria-label={`Remove ${member.userId}`}
                  onClick={() => onRemove(member)}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}
