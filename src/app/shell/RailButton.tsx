import { type ComponentType } from 'react';
import { cn } from '@/lib/utils';

export interface RailButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  showDot?: boolean;
  active?: boolean;
  /** Unread/pending count rendered as a badge. Takes precedence over `showDot`. */
  count?: number;
  className?: string;
  hasSubmenu?: boolean;
  /** Set when the button navigates to a route rather than toggling a panel. */
  isCurrentPage?: boolean;
}

/**
 * The single icon-tile control used by the vertical rail. Extracted from
 * the previous chat-scoped rail, so every rail surface renders identically.
 */
export function RailButton({
  icon: Icon,
  label,
  onClick,
  showDot = false,
  active = false,
  count,
  className,
  hasSubmenu = false,
  isCurrentPage = false,
}: RailButtonProps) {
  const badge = typeof count === 'number' && count > 0 ? count : null;

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={hasSubmenu ? active : undefined}
      aria-current={isCurrentPage ? 'page' : undefined}
      className={cn(
        'relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl',
        'transition-all duration-200 active:scale-95',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
        active
          ? 'bg-background text-foreground shadow-e1'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
        className
      )}
    >
      {active ? (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-brand" />
      ) : null}
      <Icon className="h-5 w-5" />
      {hasSubmenu ? (
        <span aria-hidden="true" className="absolute bottom-1 right-1 text-3xs opacity-70">
          ▾
        </span>
      ) : null}
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-3xs font-bold text-brand-foreground ring-2 ring-background">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : showDot ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-background" />
      ) : null}
    </button>
  );
}
