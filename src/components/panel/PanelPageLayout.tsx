import { ReactNode } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface PanelPageLayoutProps {
  title: string;
  description?: string;
  onBack: () => void;
  onClose: () => void;
  headerActions?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

interface PanelSectionProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function PanelPageLayout({
  title,
  description,
  onBack,
  onClose,
  headerActions,
  nav,
  children,
  className,
  contentClassName,
}: PanelPageLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex h-[100dvh] w-full max-w-6xl flex-col px-3 py-3 sm:px-5 sm:py-5">
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-border/70 bg-card/95 shadow-[0_20px_70px_rgba(15,23,42,0.10)] backdrop-blur',
            className
          )}
        >
          <div className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 h-10 w-10 shrink-0 rounded-full"
                  onClick={onBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 space-y-1">
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
                  {description ? (
                    <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {headerActions}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {nav ? <div className="mt-4 border-t border-border/60 pt-4">{nav}</div> : null}
          </div>

          <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8', contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PanelSection({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: PanelSectionProps) {
  return (
    <section className={cn('overflow-hidden rounded-3xl border border-border/70 bg-background/70 shadow-sm', className)}>
      {(title || description || action) ? (
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-base font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={cn('px-4 py-4 sm:px-5 sm:py-5', bodyClassName)}>{children}</div>
    </section>
  );
}
