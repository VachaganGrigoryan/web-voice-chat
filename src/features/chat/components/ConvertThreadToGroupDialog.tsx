import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Lock } from 'lucide-react';
import { Conversation, ThreadConversationView, UserSummary } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
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
import { cn } from '@/lib/utils';

interface ConvertThreadToGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  thread: ThreadConversationView | null;
  contacts: Conversation[];
  currentUserId: string | null;
  onConvert: (data: { title: string; participantIds: string[] }) => Promise<void>;
}

function userLabel(user: UserSummary) {
  return user.display_name || user.username || user.id;
}

export function ConvertThreadToGroupDialog({
  open,
  onOpenChange,
  thread,
  contacts,
  currentUserId,
  onConvert,
}: ConvertThreadToGroupDialogProps) {
  const [title, setTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const requiredUsers = useMemo(
    () =>
      (thread?.thread.participant_users || []).filter(
        (user) => user.id !== currentUserId && !user.is_ghost
      ),
    [currentUserId, thread]
  );
  const requiredIds = useMemo(
    () => new Set(requiredUsers.map((user) => user.id)),
    [requiredUsers]
  );

  const candidates = useMemo(() => {
    const dmPeers = contacts
      .filter(
        (conversation) =>
          conversation.type === 'dm' &&
          conversation.peer_user &&
          !conversation.peer_user.is_ghost &&
          conversation.peer_user.id !== currentUserId
      )
      .map((conversation) => conversation.peer_user!);
    const byId = new Map<string, UserSummary>();
    [...requiredUsers, ...dmPeers].forEach((user) => byId.set(user.id, user));
    return [...byId.values()].sort((left, right) =>
      userLabel(left).localeCompare(userLabel(right))
    );
  }, [contacts, currentUserId, requiredUsers]);

  useEffect(() => {
    if (!open) return;
    setTitle(thread?.parent?.title ? `${thread.parent.title} thread` : 'Thread group');
    setSelectedIds([...requiredIds]);
  }, [open, requiredIds, thread]);

  const toggle = (userId: string) => {
    if (requiredIds.has(userId)) return;
    setSelectedIds((current) =>
      current.includes(userId)
        ? current.filter((item) => item !== userId)
        : [...current, userId]
    );
  };

  const close = () => {
    if (isConverting) return;
    onOpenChange(false);
    setTitle('');
    setSelectedIds([]);
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || selectedIds.length === 0 || isConverting) return;
    setIsConverting(true);
    try {
      await onConvert({ title: trimmed, participantIds: selectedIds });
      onOpenChange(false);
      setTitle('');
      setSelectedIds([]);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Convert thread</DialogTitle>
          <DialogDescription>Create a group from this thread conversation.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Group title"
            maxLength={80}
          />

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {candidates.map((user) => {
              const selected = selectedIds.includes(user.id);
              const required = requiredIds.has(user.id);
              const label = userLabel(user);
              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => toggle(user.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                    selected
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/50'
                  )}
                >
                  <Avatar className="h-9 w-9 border">
                    {user.avatar ? <AvatarImage src={user.avatar.url} /> : null}
                    <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                  {required ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : selected ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isConverting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!title.trim() || selectedIds.length === 0 || isConverting}
          >
            {isConverting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting
              </>
            ) : (
              'Create group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
