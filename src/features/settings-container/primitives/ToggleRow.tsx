import { useId } from 'react';
import { cn } from '@/lib/utils';
import { SettingsRow } from './SettingsRow';

interface ToggleRowProps {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/**
 * The checkbox stays in the accessibility tree as `sr-only` rather than being
 * `hidden`, so the control is reachable and toggleable by keyboard and the
 * focus ring is driven off its focus state.
 */
export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  const id = useId();

  return (
    <SettingsRow
      title={title}
      description={description}
      htmlFor={id}
      className={cn(disabled && 'opacity-60')}
      control={
        <span className="relative inline-flex cursor-pointer items-center">
          <input
            id={id}
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span
            aria-hidden
            className={cn(
              'h-6 w-11 rounded-full transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background',
              checked ? 'bg-primary' : 'border border-border bg-muted',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer'
            )}
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform duration-200',
              checked ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </span>
      }
    />
  );
}
