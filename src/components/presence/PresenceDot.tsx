import { PresenceState } from '@/api/types';
import { cn } from '@/lib/utils';

const PRESENCE_LABEL: Record<PresenceState, string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do not disturb',
  offline: 'Offline',
};

const PRESENCE_COLOR: Record<PresenceState, string> = {
  online: 'bg-presence-online',
  away: 'bg-presence-away',
  dnd: 'bg-presence-dnd',
  offline: 'bg-presence-offline',
};

const SIZE: Record<PresenceSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

export type PresenceSize = 'sm' | 'md' | 'lg';

/**
 * Resolves the four-state presence from a user summary that may only carry the
 * legacy `is_online` boolean. Callers should not re-derive this inline.
 */
export function resolvePresenceState(user: {
  presence_state?: PresenceState;
  is_online?: boolean | null;
} | null | undefined): PresenceState {
  if (!user) return 'offline';
  if (user.presence_state) return user.presence_state;
  return user.is_online ? 'online' : 'offline';
}

interface PresenceDotProps {
  state: PresenceState;
  size?: PresenceSize;
  /** Renders as an overlay badge anchored to the bottom-right of a relative parent. */
  anchored?: boolean;
  /** Offline is usually hidden in lists; set true to always render the dot. */
  showOffline?: boolean;
  className?: string;
}

export function PresenceDot({
  state,
  size = 'md',
  anchored = false,
  showOffline = false,
  className,
}: PresenceDotProps) {
  if (state === 'offline' && !showOffline) return null;

  return (
    <span
      role="img"
      aria-label={PRESENCE_LABEL[state]}
      title={PRESENCE_LABEL[state]}
      className={cn(
        'block shrink-0 rounded-full',
        SIZE[size],
        PRESENCE_COLOR[state],
        anchored && 'absolute bottom-0 right-0 ring-2 ring-background',
        className
      )}
    />
  );
}
