import { useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Archive, ArchiveRestore, FolderInput, Pin, PinOff } from 'lucide-react';
import { Conversation } from '@/api/types';
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
import { useConversationActions } from '../hooks/useConversationActions';

interface InboxRowMenuProps {
  conversation: Conversation;
  folders: string[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Per-row inbox actions: pin, archive, and folder assignment for the caller. */
export function InboxRowMenu({ conversation, folders, isOpen, onOpenChange }: InboxRowMenuProps) {
  const { setInboxState } = useConversationActions();
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState(conversation.folder ?? '');

  const conversationId = conversation.id;

  const apply = (updates: { pinned?: boolean; archived?: boolean; folder?: string | null }) => {
    setInboxState.mutate({ conversationId, updates });
    onOpenChange(false);
  };

  const stop = (event: ReactMouseEvent<HTMLElement>) => event.stopPropagation();

  return (
    <>
      <div className="relative" onClick={stop}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-11 w-11 rounded-full text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground',
            'opacity-100 md:opacity-0 md:group-hover:opacity-100',
            isOpen && 'bg-muted text-foreground opacity-100'
          )}
          onClick={(event) => {
            event.stopPropagation();
            onOpenChange(!isOpen);
          }}
          aria-label="Inbox actions"
        >
          <Pin className={cn('h-4 w-4', conversation.pinned && 'fill-current text-primary')} />
        </Button>

        {isOpen ? (
          <>
            <button
              type="button"
              aria-hidden
              className="fixed inset-0 z-40 cursor-default"
              onClick={(event) => {
                event.stopPropagation();
                onOpenChange(false);
              }}
            />
            <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border bg-popover p-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => apply({ pinned: !conversation.pinned })}
              >
                {conversation.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {conversation.pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => apply({ archived: !conversation.archived })}
              >
                {conversation.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                {conversation.archived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  setFolderName(conversation.folder ?? '');
                  setIsFolderDialogOpen(true);
                  onOpenChange(false);
                }}
              >
                <FolderInput className="h-4 w-4" />
                Move to folder…
              </button>
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-5" onClick={stop}>
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>Organize this conversation. Leave empty to remove it from folders.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Folder name"
              maxLength={80}
            />
            {folders.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => setFolderName(folder)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs',
                      folderName === folder
                        ? 'border-primary/40 bg-primary/5 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                    )}
                  >
                    {folder}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const trimmed = folderName.trim();
                setInboxState.mutate({
                  conversationId,
                  updates: { folder: trimmed ? trimmed : null },
                });
                setIsFolderDialogOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
