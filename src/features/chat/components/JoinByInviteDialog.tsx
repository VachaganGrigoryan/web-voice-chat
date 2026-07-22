import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { extractApiError } from '@/api/errors';
import { useConversationActions } from '../hooks/useConversationActions';

interface JoinByInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJoined: (conversationId: string) => void;
}

/** Extracts a bare invite code from a pasted code or a full invite URL. */
function parseInviteCode(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/invites\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : trimmed;
}

export function JoinByInviteDialog({ open, onOpenChange, onJoined }: JoinByInviteDialogProps) {
  const { redeemInvite } = useConversationActions();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const close = () => {
    setValue('');
    setError(null);
    setPending(false);
    onOpenChange(false);
  };

  const submit = async () => {
    const code = parseInviteCode(value);
    if (!code || redeemInvite.isPending) return;
    setError(null);
    setPending(false);
    try {
      const result = await redeemInvite.mutateAsync(code);
      if (result.status === 'joined' && result.conversation) {
        onJoined(result.conversation.conversation_id);
        close();
        return;
      }
      // Approval required — keep the dialog open with a confirmation note.
      setPending(true);
    } catch (err) {
      setError(extractApiError(err, 'This invite is invalid or has expired'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Join by invite</DialogTitle>
          <DialogDescription>Paste an invite code or link to join a conversation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="invite-code">Invite code or link</Label>
            <Input
              id="invite-code"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setPending(false);
                setError(null);
              }}
              placeholder="e.g. Ab3xYz… or a full invite link"
              autoFocus
            />
          </div>

          {pending ? (
            <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              Your request to join was sent. An admin needs to approve it.
            </p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={redeemInvite.isPending}>
            {pending ? 'Close' : 'Cancel'}
          </Button>
          {!pending ? (
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={!parseInviteCode(value) || redeemInvite.isPending}
            >
              {redeemInvite.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining
                </>
              ) : (
                'Join'
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
