import { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Conversation } from '@/api/types';
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

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Conversation[];
  currentUserId: string | null;
  onCreateGroup: (data: { title: string; participantIds: string[] }) => Promise<void>;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  contacts,
  currentUserId,
  onCreateGroup,
}: CreateGroupDialogProps) {
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const groupCandidates = useMemo(
    () =>
      contacts
        .filter(
          (conversation) =>
            conversation.type === 'dm' &&
            conversation.peer_user &&
            !conversation.peer_user.is_ghost &&
            conversation.peer_user.id !== currentUserId
        )
        .map((conversation) => conversation.peer_user!)
        .filter(
          (peer, index, peers) => peers.findIndex((candidate) => candidate.id === peer.id) === index
        ),
    [contacts, currentUserId]
  );

  const toggleGroupMember = (userId: string) => {
    setSelectedGroupMemberIds((current) =>
      current.includes(userId)
        ? current.filter((selectedId) => selectedId !== userId)
        : [...current, userId]
    );
  };

  const close = () => {
    onOpenChange(false);
    setGroupTitle('');
    setSelectedGroupMemberIds([]);
  };

  const submitGroup = async () => {
    const title = groupTitle.trim();
    if (!title || selectedGroupMemberIds.length === 0 || isCreatingGroup) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      await onCreateGroup({ title, participantIds: selectedGroupMemberIds });
      close();
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>Select members from existing chats.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={groupTitle}
            onChange={(event) => setGroupTitle(event.target.value)}
            placeholder="Group title"
            maxLength={80}
          />

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {groupCandidates.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No available contacts
              </div>
            ) : (
              groupCandidates.map((peer) => {
                const isSelected = selectedGroupMemberIds.includes(peer.id);
                const label = peer.display_name || peer.username || peer.id;
                return (
                  <button
                    key={peer.id}
                    type="button"
                    onClick={() => toggleGroupMember(peer.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    )}
                  >
                    <Avatar className="h-9 w-9 border">
                      {peer.avatar ? <AvatarImage src={peer.avatar.url} /> : null}
                      <AvatarFallback>{(label[0] || '?').toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={isCreatingGroup}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submitGroup()}
            disabled={!groupTitle.trim() || selectedGroupMemberIds.length === 0 || isCreatingGroup}
          >
            {isCreatingGroup ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              'Create'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
