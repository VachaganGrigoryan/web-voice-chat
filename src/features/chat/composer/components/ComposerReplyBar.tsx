import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ComposerReplyTarget } from '../../types/message';

interface ComposerReplyBarProps {
  replyTarget?: ComposerReplyTarget | null;
  onClear?: () => void;
}

export function ComposerReplyBar({
  replyTarget,
  onClear,
}: ComposerReplyBarProps) {
  if (!replyTarget) {
    return null;
  }

  return (
    <div className="mb-2 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {replyTarget.mode === 'thread' ? 'Thread Reply' : 'Reply'}
        </div>
        <div className="text-xs text-muted-foreground">{replyTarget.senderLabel}</div>
        <div className="truncate text-sm text-foreground">{replyTarget.previewText}</div>
      </div>
      {onClear ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
