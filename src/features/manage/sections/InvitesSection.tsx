import { Loader2, Trash2 } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { UserSearch } from '@/features/discovery/UserSearch';

export interface ManageInviteLink {
  readonly id: string;
  readonly code: string;
  readonly useCount: number;
  readonly maxUses: number | null;
  readonly revoked: boolean;
}

interface InviteLinksConfig {
  readonly links: readonly ManageInviteLink[];
  readonly isLoading: boolean;
  readonly onCreate: () => void;
  readonly isCreating: boolean;
  readonly onRevoke: (inviteId: string) => void;
  readonly isRevoking: boolean;
}

interface InvitesSectionProps {
  onInviteUser: (userId: string) => void;
  isInvitingUser: boolean;
  /** Only conversations and spaces have shareable invite links today. */
  inviteLinks?: InviteLinksConfig;
}

/**
 * Direct invite (every resource type) plus shareable invite links, where the
 * resource supports them. Channels don't have an invite-link endpoint yet, so
 * `ManageChannelPage` omits `inviteLinks` rather than faking one.
 */
export function InvitesSection({ onInviteUser, isInvitingUser, inviteLinks }: InvitesSectionProps) {
  return (
    <>
      <PanelSection title="Invite people" description="Add someone directly, by username.">
        <UserSearch onSelectUser={onInviteUser} />
        {isInvitingUser ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sending invite…
          </p>
        ) : null}
      </PanelSection>

      {inviteLinks ? (
        <PanelSection
          title="Invite links"
          description="Anyone with the link can use it to join."
          action={
            <Button type="button" size="sm" disabled={inviteLinks.isCreating} onClick={inviteLinks.onCreate}>
              {inviteLinks.isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'New link'}
            </Button>
          }
        >
          {inviteLinks.isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : inviteLinks.links.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              No active invite links.
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
              {inviteLinks.links.map((link) => (
                <div key={link.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <span className="block truncate font-mono text-sm">{link.code}</span>
                    <span className="text-xs text-muted-foreground">
                      Used {link.useCount}
                      {link.maxUses ? ` / ${link.maxUses}` : ''} times
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                    disabled={inviteLinks.isRevoking}
                    aria-label="Revoke invite link"
                    onClick={() => inviteLinks.onRevoke(link.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </PanelSection>
      ) : null}
    </>
  );
}
