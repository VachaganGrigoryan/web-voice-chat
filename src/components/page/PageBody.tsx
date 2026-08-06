import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageBodyProps {
  children: ReactNode;
  /** Constrains reading measure for prose/feed surfaces. Lists should stay full width. */
  narrow?: boolean;
  className?: string;
}

/**
 * Scroll container for a destination's main pane. Pairs with <PageHeader/>; the
 * header stays fixed while only this region scrolls.
 */
export function PageBody({ children, narrow = false, className }: PageBodyProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div
        className={cn(
          'px-4 py-4 sm:px-6 sm:py-6',
          narrow && 'mx-auto w-full max-w-3xl',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}
