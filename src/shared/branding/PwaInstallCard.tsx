import { CheckCircle2, Download, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { usePwaInstallPrompt } from '@/hooks/usePwaInstallPrompt';
import { BRAND } from './brand';
import { Logo } from './Logo';

interface PwaInstallCardProps {
  className?: string;
  showInstalledState?: boolean;
  showUnavailableState?: boolean;
}

export function PwaInstallCard({
  className,
  showInstalledState = false,
  showUnavailableState = false,
}: PwaInstallCardProps) {
  const { canInstall, isInstalled, isInstalling, install } = usePwaInstallPrompt();

  if (!canInstall && !(showInstalledState && isInstalled) && !showUnavailableState) {
    return null;
  }

  const isUnavailable = !canInstall && !isInstalled;
  const title = isInstalled ? `${BRAND.name} is installed` : `Install ${BRAND.name}`;
  const description = isInstalled
    ? 'Open it from your home screen or app launcher for a more native feel.'
    : isUnavailable
      ? 'This browser has install support disabled right now, but the app is configured for standalone install when supported.'
      : 'Add the app to your home screen for faster access, standalone mode, and a cleaner shell.';

  return (
    <div
      className={cn(
        'rounded-[28px] border border-border/70 bg-card/95 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-white dark:bg-white dark:text-black">
          <Logo size="sm" variant="symbol" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold tracking-tight text-foreground">{title}</span>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {isInstalled ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Installed
          </div>
        ) : isUnavailable ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            Install prompt unavailable
          </div>
        ) : (
          <Button type="button" className="rounded-full" onClick={() => void install()} disabled={isInstalling}>
            {isInstalling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opening prompt
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Install {BRAND.shortName}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
