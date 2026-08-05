import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  title: string;
  description?: string;
  /** Rendered to the right on wide rows, below the label on narrow ones. */
  control?: ReactNode;
  /** Full-width content under the label, for controls that need the room. */
  children?: ReactNode;
  htmlFor?: string;
  className?: string;
}

/**
 * The one row shape every settings control sits in, so a toggle, a select and a
 * rule read as the same list rather than three different forms.
 */
export function SettingsRow({
  title,
  description,
  control,
  children,
  htmlFor,
  className,
}: SettingsRowProps) {
  const Label = htmlFor ? 'label' : 'div';

  return (
    <div className={cn('py-3 first:pt-0 last:pb-0', className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <Label
          {...(htmlFor ? { htmlFor } : {})}
          className="min-w-0 flex-1 space-y-1"
        >
          <span className="block text-sm font-medium leading-none">{title}</span>
          {description ? (
            <span className="block text-sm text-muted-foreground">{description}</span>
          ) : null}
        </Label>
        {control ? <div className="shrink-0">{control}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

/** Divided stack of rows. Sections use this instead of spacing rows by hand. */
export function SettingsRowGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('divide-y divide-border/60', className)}>{children}</div>;
}
