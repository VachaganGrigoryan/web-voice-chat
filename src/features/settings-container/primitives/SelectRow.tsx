import { useId } from 'react';
import { cn } from '@/lib/utils';
import { SettingsRow } from './SettingsRow';

export interface SelectRowOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface SelectRowProps<T extends string> {
  title: string;
  description?: string;
  value: T;
  options: readonly SelectRowOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** For settings with many values or no audience meaning; rules use `SegmentedRule`. */
export function SelectRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
  disabled = false,
}: SelectRowProps<T>) {
  const id = useId();

  return (
    <SettingsRow
      title={title}
      description={description}
      htmlFor={id}
      control={
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value as T)}
          className={cn(
            'min-h-9 min-w-44 cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      }
    />
  );
}
