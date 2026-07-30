import { type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InboxSectionProps {
  label: string;
  count: number;
  /** Unread total across the section; shown while collapsed so nothing hides. */
  unreadCount?: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * A collapsible group in the inbox column. The unread total stays visible when
 * collapsed so folding a section never hides activity from the user.
 */
export function InboxSection({
  label,
  count,
  unreadCount = 0,
  isCollapsed,
  onToggle,
  children,
}: InboxSectionProps) {
  if (count === 0) return null;

  return (
    <section className="space-y-2">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!isCollapsed}
          className="group flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-0.5 py-1 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'h-3 w-3 shrink-0 transition-transform duration-150 motion-reduce:transition-none',
              isCollapsed && '-rotate-90'
            )}
          />
          <span className="truncate">{label}</span>
          <span className="ml-auto flex items-center gap-1.5">
            {isCollapsed && unreadCount > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-3xs font-bold text-brand-foreground">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
            <span className="tabular-nums text-muted-foreground/70">{count}</span>
          </span>
        </button>
      </h3>
      {isCollapsed ? null : <div className="space-y-2">{children}</div>}
    </section>
  );
}
