import {
  ACTIVITY_DESTINATION,
  DestinationDefinition,
  NavBadgeCounts,
  PRIMARY_DESTINATIONS,
  getDestinationForPath,
} from '@/app/navigation/navConfig';
import { cn } from '@/lib/utils';

interface MobileTabBarProps {
  pathname: string;
  badges: NavBadgeCounts;
  onNavigate: (path: string) => void;
}

function TabButton({
  destination,
  count,
  activeDestinationId,
  onNavigate,
}: {
  destination: DestinationDefinition;
  count?: number;
  activeDestinationId: string | null;
  onNavigate: (path: string) => void;
}) {
  const Icon = destination.icon;
  const isActive = destination.id === activeDestinationId;
  const badge = typeof count === 'number' && count > 0 ? count : null;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onNavigate(destination.path)}
      className={cn(
        'relative flex min-h-[56px] flex-1 cursor-pointer flex-col items-center justify-center gap-1 py-2 text-2xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        isActive ? 'text-brand' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-brand"
        />
      ) : null}
      <span className="relative">
        <Icon className="h-5 w-5" />
        {badge ? (
          <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-3xs font-bold text-brand-foreground">
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </span>
      {destination.label}
    </button>
  );
}

/**
 * Mobile equivalent of the rail's destination zone. Unlike the previous bar this
 * is route-derived and lives in the shell, so it stays mounted on every screen.
 */
export function MobileTabBar({ pathname, badges, onNavigate }: MobileTabBarProps) {
  const activeDestinationId = getDestinationForPath(pathname);

  return (
    <nav
      role="tablist"
      aria-label="Primary"
      className="flex shrink-0 items-stretch border-t bg-background md:hidden"
    >
      {PRIMARY_DESTINATIONS.map((destination) => (
        <TabButton
          key={destination.id}
          destination={destination}
          count={destination.badge ? badges[destination.badge] : undefined}
          activeDestinationId={activeDestinationId}
          onNavigate={onNavigate}
        />
      ))}
      <TabButton
        destination={ACTIVITY_DESTINATION}
        count={badges.activity}
        activeDestinationId={activeDestinationId}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
