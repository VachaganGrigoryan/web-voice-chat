import { type ReactNode, useState } from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { PageAction, SecondaryActions } from './pageTypes';

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Rendered under the title row — normally a <PageTabs/>. */
  tabs?: ReactNode;
  /** The one filled call-to-action for this page. */
  primaryAction?: PageAction;
  /** At most two ghost actions; a third is a compile error by design. */
  secondaryActions?: SecondaryActions;
  /** Everything else, behind a kebab. Unlimited. */
  overflowActions?: readonly PageAction[];
  /** Mobile/back affordance; omit on top-level destinations. */
  onBack?: () => void;
  className?: string;
}

function OverflowMenu({ actions }: { actions: readonly PageAction[] }) {
  const [isOpen, setIsOpen] = useState(false);

  const run = (action: PageAction) => {
    setIsOpen(false);
    action.onSelect();
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 cursor-pointer"
        aria-label="More actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((current) => !current)}
      >
        <MoreVertical className="h-4 w-4" />
      </Button>
      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border bg-popover p-1.5 shadow-e3 animate-in fade-in slide-in-from-top-1 duration-100"
          >
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  type="button"
                  role="menuitem"
                  disabled={action.disabled}
                  onClick={() => run(action)}
                  className={cn(
                    'flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                    action.destructive
                      ? 'text-destructive hover:bg-destructive/10'
                      : 'text-foreground/80 hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Header for every destination inside the app shell. Deliberately structural:
 * it owns the action budget so pages cannot accumulate toolbars.
 */
export function PageHeader({
  title,
  description,
  tabs,
  primaryAction,
  secondaryActions,
  overflowActions,
  onBack,
  className,
}: PageHeaderProps) {
  const PrimaryIcon = primaryAction?.icon;

  return (
    <header
      className={cn(
        'shrink-0 border-b border-border/70 bg-background px-4 pt-4 sm:px-6',
        tabs ? 'pb-0' : 'pb-4',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 h-9 w-9 shrink-0 cursor-pointer"
            aria-label="Go back"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {secondaryActions?.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 cursor-pointer"
                aria-label={action.label}
                title={action.label}
                disabled={action.disabled}
                onClick={action.onSelect}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}

          {primaryAction && PrimaryIcon ? (
            <Button
              type="button"
              size="sm"
              className="cursor-pointer gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              disabled={primaryAction.disabled}
              onClick={primaryAction.onSelect}
            >
              <PrimaryIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{primaryAction.label}</span>
            </Button>
          ) : null}

          {overflowActions?.length ? <OverflowMenu actions={overflowActions} /> : null}
        </div>
      </div>

      {tabs ? <div className="mt-3">{tabs}</div> : null}
    </header>
  );
}
