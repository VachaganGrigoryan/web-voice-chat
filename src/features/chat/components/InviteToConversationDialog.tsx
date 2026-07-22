import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Loader2, Trash2 } from 'lucide-react';
import { conversationsApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';

interface InviteToConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
}

/**
 * Per-conversation invite management for channels/groups: generate a shareable
 * invite code, list active invites, and revoke them. The recipient joins via
 * "Join by code" on the Pings screen. Reuses the existing invite REST API.
 */
export function InviteToConversationDialog({
  open,
  onOpenChange,
  conversationId,
}: InviteToConversationDialogProps) {
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const invitesKey = ['conversation-invites', conversationId];

  const invitesQuery = useQuery({
    queryKey: invitesKey,
    queryFn: () => conversationsApi.listInvites(conversationId),
    enabled: open,
  });

  const createInvite = useMutation({
    mutationFn: () => conversationsApi.createInvite(conversationId, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitesKey }),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => conversationsApi.revokeInvite(conversationId, inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitesKey }),
  });

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode((current) => (current === code ? null : current)), 1500);
    } catch {
      // Clipboard unavailable — the code stays visible for manual copy.
    }
  };

  const activeInvites = (invitesQuery.data ?? []).filter((invite) => !invite.revoked);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            Share an invite code. People join from Pings → “Join by code”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button
            type="button"
            onClick={() => createInvite.mutate()}
            disabled={createInvite.isPending}
            className="w-full"
          >
            {createInvite.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating invite
              </>
            ) : (
              'Create invite code'
            )}
          </Button>

          <div className="space-y-2">
            {invitesQuery.isLoading ? (
              <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading invites…
              </div>
            ) : activeInvites.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No active invites yet
              </div>
            ) : (
              activeInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
                >
                  <code className="min-w-0 flex-1 truncate font-mono text-sm">{invite.code}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => void copyCode(invite.code)}
                    title="Copy code"
                    aria-label="Copy invite code"
                  >
                    {copiedCode === invite.code ? (
                      <Check className={cn('h-4 w-4 text-primary')} />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => revokeInvite.mutate(invite.id)}
                    disabled={revokeInvite.isPending}
                    title="Revoke invite"
                    aria-label="Revoke invite"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
