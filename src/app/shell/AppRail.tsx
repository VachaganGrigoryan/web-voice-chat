import { useState } from 'react';
import { LogOut, Plus, Search, Settings, UserRound } from 'lucide-react';
import { User } from '@/api/types';
import {
  ACTIVITY_DESTINATION,
  CREATE_ACTIONS,
  NavBadgeCounts,
  PRIMARY_DESTINATIONS,
  getDestinationForPath,
} from '@/app/navigation/navConfig';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { SpaceSwitcher } from './SpaceSwitcher';
import { cn } from '@/lib/utils';
import { RailButton } from './RailButton';

interface AppRailProps {
  pathname: string;
  badges: NavBadgeCounts;
  profile: User | null | undefined;
  userEmail: string | null;
  selectedSpaceId: string | null;
  onSpaceChange: (spaceId: string | null) => void;
  onNavigate: (path: string) => void;
  onCreate: (actionId: string) => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

/**
 * The persistent 68px rail. Primary destinations are always visible; Activity
 * sits in the utility dock above the account menu.
 */
export function AppRail({
  pathname,
  badges,
  profile,
  userEmail,
  selectedSpaceId,
  onSpaceChange,
  onNavigate,
  onCreate,
  onOpenSearch,
  onOpenSettings,
  onLogout,
}: AppRailProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileLabel = profile?.display_name || profile?.username || userEmail || 'Account';
  const profileFallback = (profileLabel[0] || '?').toUpperCase();

  const ActivityIcon = ACTIVITY_DESTINATION.icon;
  const activeDestinationId = getDestinationForPath(pathname);
  const isActivityActive = activeDestinationId === ACTIVITY_DESTINATION.id;

  const runCreate = (actionId: string) => {
    setIsCreateOpen(false);
    onCreate(actionId);
  };

  const runProfile = (action: () => void) => {
    setIsProfileOpen(false);
    action();
  };

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-muted/10 py-3 md:flex',
        'transition-colors duration-300 motion-reduce:transition-none'
      )}
    >
      {/* Zone 1 — space scope */}
      <SpaceSwitcher
        variant="rail"
        selectedSpaceId={selectedSpaceId}
        onSpaceChange={onSpaceChange}
      />

      <div className="my-1 h-px w-8 bg-border/50" />

      {/* Zone 2 — destinations */}
      {PRIMARY_DESTINATIONS.map((destination) => (
        <RailButton
          key={destination.id}
          icon={destination.icon}
          label={destination.label}
          active={activeDestinationId === destination.id}
          isCurrentPage={activeDestinationId === destination.id}
          count={destination.badge ? badges[destination.badge] : undefined}
          onClick={() => onNavigate(destination.path)}
        />
      ))}

      <div className="my-1 h-px w-8 bg-border/50" />

      {/* Zone 3 — create */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsCreateOpen((current) => !current)}
          title="Create new..."
          aria-label="Create new"
          aria-expanded={isCreateOpen}
          aria-haspopup="menu"
          className={cn(
            'flex h-11 w-11 cursor-pointer items-center justify-center rounded-2xl bg-brand text-brand-foreground shadow-e2',
            'transition-all duration-200 hover:bg-brand/90 active:scale-95',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <Plus className="h-5 w-5" />
        </button>
        {isCreateOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsCreateOpen(false)} />
            <div
              role="menu"
              className="fixed left-[72px] z-50 w-48 rounded-xl border bg-popover p-1.5 shadow-e3 animate-in fade-in slide-in-from-left-1 duration-100"
            >
              {CREATE_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.id}
                    type="button"
                    role="menuitem"
                    onClick={() => runCreate(action.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* Zone 4 — utility + self dock */}
      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton
          icon={Search}
          label="Search"
          active={false}
          isCurrentPage={false}
          onClick={onOpenSearch}
        />

        <RailButton
          icon={ActivityIcon}
          label={ACTIVITY_DESTINATION.label}
          active={isActivityActive}
          isCurrentPage={isActivityActive}
          count={badges.activity}
          onClick={() => onNavigate(ACTIVITY_DESTINATION.path)}
        />

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
            title={profileLabel}
            aria-label="Account menu"
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className={cn(
              'flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl transition-all duration-200 active:scale-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
              isProfileOpen ? 'ring-2 ring-brand/40' : 'hover:bg-background'
            )}
          >
            <Avatar className="h-9 w-9 border border-border/60">
              {profile?.avatar?.url ? (
                <AvatarImage src={profile.avatar.url} className="object-cover" />
              ) : null}
              <AvatarFallback>{profileFallback}</AvatarFallback>
            </Avatar>
          </button>
          {isProfileOpen ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
              <div
                role="menu"
                className="fixed bottom-3 left-[72px] z-50 w-48 rounded-xl border bg-popover p-1.5 shadow-e3 animate-in fade-in slide-in-from-left-1 duration-100"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runProfile(() => onNavigate('/me'))}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <UserRound className="h-4 w-4 shrink-0" />
                  My profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runProfile(onOpenSettings)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  Settings
                </button>
                <div className="my-1 border-t opacity-40" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runProfile(onLogout)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
