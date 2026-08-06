import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { matchesConfirmPhrase } from './confirmPhrase';

interface ConfirmDestructiveActionDialogProps {
  open: boolean;
  title: string;
  description: string;
  actionLabel: string;
  isPending?: boolean;
  /**
   * When set, the exact phrase the viewer must type before confirming.
   * Omitted for per-viewer actions, which keep their single-step confirmation.
   */
  confirmPhrase?: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDestructiveActionDialog({
  open,
  title,
  description,
  actionLabel,
  isPending = false,
  confirmPhrase,
  onOpenChange,
  onConfirm,
}: ConfirmDestructiveActionDialogProps) {
  const inputId = useId();
  const [typed, setTyped] = useState('');

  // Reset between openings so a previously satisfied phrase cannot carry over
  // to the next resource the dialog is reused for.
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  useEffect(() => {
    setTyped('');
  }, [confirmPhrase]);

  const confirmed = matchesConfirmPhrase(typed, confirmPhrase);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {confirmPhrase ? (
          <div className="space-y-1.5">
            <Label htmlFor={inputId}>
              Type <span className="font-semibold text-foreground">{confirmPhrase}</span> to
              confirm
            </Label>
            <Input
              id={inputId}
              value={typed}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={isPending}
              placeholder={confirmPhrase}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void onConfirm()}
            disabled={isPending || !confirmed}
          >
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {actionLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
