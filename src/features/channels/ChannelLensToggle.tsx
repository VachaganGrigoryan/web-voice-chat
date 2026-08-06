import { LayoutList, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChannelLens } from './useChannelLens';

const OPTIONS: ReadonlyArray<{
  value: ChannelLens;
  label: string;
  icon: typeof MessageSquare;
  hint: string;
}> = [
  { value: 'chat', label: 'Chat', icon: MessageSquare, hint: 'Read as a message timeline' },
  { value: 'feed', label: 'Feed', icon: LayoutList, hint: 'Read as a feed of posts' },
];

interface ChannelLensToggleProps {
  lens: ChannelLens;
  onChange: (lens: ChannelLens) => void;
  className?: string;
}

/**
 * Switches how a channel renders by navigating to that lens's route — the URL
 * is the only source of the lens, so a channel view can be linked and shared in
 * a specific lens. Both lens routes live inside the chat shell, so switching
 * still never drops the reader out of their inbox.
 */
export function ChannelLensToggle({ lens, onChange, className }: ChannelLensToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Channel view"
      className={cn('inline-flex items-center gap-0.5 rounded-full bg-muted/70 p-0.5', className)}
    >
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = option.value === lens;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium',
              'transition-colors duration-200 motion-reduce:transition-none',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
              isActive
                ? 'bg-brand text-brand-foreground shadow-e1'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
