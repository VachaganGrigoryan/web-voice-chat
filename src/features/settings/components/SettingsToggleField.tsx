import { cn } from '@/lib/utils';

interface SettingsToggleFieldProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function SettingsToggleField({
  title,
  description,
  checked,
  onChange,
}: SettingsToggleFieldProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border bg-background/80 p-4 shadow-sm transition-colors hover:bg-accent/40">
      <div className="space-y-1 pr-4">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary' : 'border bg-muted'
        )}
      >
        <div
          className={cn(
            'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </div>
      <input
        type="checkbox"
        className="hidden"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
