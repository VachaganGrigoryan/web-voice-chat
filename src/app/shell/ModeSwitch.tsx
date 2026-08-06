import { MessageSquare, Rss, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AppMode = 'chat' | 'social';

interface ModeSwitchProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

const LEGACY_MODES: readonly {
  id: AppMode;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'social', label: 'Social', icon: Rss },
];

/**
 * Two-position switch between the messenger and the social surface. Rendered as a
 * physical sliding puck so the mode change is felt, not just inferred from the
 * icons that swap below it.
 */
export function ModeSwitch({
  mode,
  onModeChange,
  orientation = 'vertical',
  className,
}: ModeSwitchProps) {
  const activeIndex = LEGACY_MODES.findIndex((entry) => entry.id === mode);
  const isVertical = orientation === 'vertical';

  return (
    <div
      role="radiogroup"
      aria-label="App mode"
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      className={cn(
        'relative rounded-2xl bg-muted/60 p-1',
        isVertical ? 'flex flex-col gap-1' : 'inline-flex flex-row gap-1',
        className
      )}
    >
      {/* The puck. Sized to one slot and translated to the active index. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute rounded-xl bg-brand shadow-e1',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          isVertical ? 'left-1 right-1 h-10' : 'top-1 bottom-1 w-10'
        )}
        style={{
          transform: isVertical
            ? `translateY(${activeIndex * 44}px)`
            : `translateX(${activeIndex * 44}px)`,
          top: isVertical ? 4 : undefined,
          left: isVertical ? undefined : 4,
        }}
      />

      {LEGACY_MODES.map((entry) => {
        const Icon = entry.icon;
        const isActive = entry.id === mode;

        return (
          <button
            key={entry.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${entry.label} mode`}
            title={`${entry.label} mode`}
            onClick={() => onModeChange(entry.id)}
            className={cn(
              'relative z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl',
              'transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
              isActive
                ? 'text-brand-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-[18px] w-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
