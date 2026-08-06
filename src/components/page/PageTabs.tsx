import { cn } from '@/lib/utils';
import { PageTab } from './pageTypes';

interface PageTabsProps {
  tabs: readonly PageTab[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  'aria-label'?: string;
  className?: string;
}

/**
 * The single subtab treatment for the app: an underline row on desktop that
 * degrades to a horizontal pill scroller under `md`. Replaces the five divergent
 * tab styles that previously coexisted (panel nav buttons, profile underline,
 * settings pills, notification pills, sidebar folder chips).
 */
export function PageTabs({
  tabs,
  activeTabId,
  onSelect,
  'aria-label': ariaLabel = 'Sections',
  className,
}: PageTabsProps) {
  return (
    <div className={cn('scrollbar-hidden -mx-1 overflow-x-auto px-1', className)}>
      <nav
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-max items-center gap-1 md:gap-0 md:border-b md:border-border"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTabId;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              title={tab.description}
              onClick={() => onSelect(tab.id)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                // Mobile: pill
                'rounded-full px-4 py-2',
                // Desktop: underline tab
                'md:rounded-none md:border-b-2 md:px-3 md:py-2.5',
                isActive
                  ? 'bg-brand text-brand-foreground md:bg-transparent md:border-brand md:text-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground md:border-transparent md:bg-transparent md:hover:bg-transparent md:hover:text-foreground'
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              {tab.label}
              {tab.count ? (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-2xs font-semibold',
                    isActive
                      ? 'bg-brand-foreground/20 text-brand-foreground md:bg-brand md:text-brand-foreground'
                      : 'bg-background text-muted-foreground md:bg-muted'
                  )}
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
