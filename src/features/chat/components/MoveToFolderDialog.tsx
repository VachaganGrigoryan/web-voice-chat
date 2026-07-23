import { useEffect, useState } from 'react';
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

interface MoveToFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: string[];
  initialFolder: string | null;
  onSave: (folder: string | null) => void;
}

/** Assign or clear a conversation's inbox folder. Empty input removes the folder. */
export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  initialFolder,
  onSave,
}: MoveToFolderDialogProps) {
  const [folderName, setFolderName] = useState(initialFolder ?? '');

  useEffect(() => {
    if (open) {
      setFolderName(initialFolder ?? '');
    }
  }, [open, initialFolder]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Organize this conversation. Leave empty to remove it from folders.
          </DialogDescription>
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
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              const trimmed = folderName.trim();
              onSave(trimmed ? trimmed : null);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
