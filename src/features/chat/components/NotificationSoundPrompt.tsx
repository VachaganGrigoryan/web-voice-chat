import { BellRing, Volume2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface NotificationSoundPromptProps {
  isEnabling: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

export function NotificationSoundPrompt({
  isEnabling,
  onEnable,
  onDismiss,
}: NotificationSoundPromptProps) {
  return (
    <div className="border-b border-border/70 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-background/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Alert and call sounds need your approval</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Browser autoplay rules blocked sound playback. Enable it once with a click to allow future message alerts and call tones.
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" className="gap-2 rounded-full" onClick={onEnable} disabled={isEnabling}>
            <Volume2 className="h-4 w-4" />
            {isEnabling ? 'Enabling...' : 'Enable sounds'}
          </Button>
          <Button type="button" variant="ghost" className="gap-2 rounded-full" onClick={onDismiss}>
            <X className="h-4 w-4" />
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
