import { useState } from 'react';
import { LogOut, Settings, UserRound } from 'lucide-react';
import { User } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { SpaceSwitcher } from './SpaceSwitcher';
import { cn } from '@/lib/utils';

interface MobileTopBarProps {
  profile: User | null | undefined;
  userEmail: string | null;
  selectedSpaceId: string | null;
  onSpaceChange: (spaceId: string | null) => void;
  onNavigate: (path: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

/**
 * Mobile header: space scope on the left and the account menu on the right.
 * Primary destinations live in the bottom tab bar.
 */
export function MobileTopBar({
  profile,
  userEmail,
  selectedSpaceId,
  onSpaceChange,
  onNavigate,
  onOpenSettings,
  onLogout,
}: MobileTopBarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileLabel = profile?.display_name || profile?.username || userEmail || 'Account';
  const profileFallback = (profileLabel[0] || '?').toUpperCase();

  const runProfile = (action: () => void) => {
    setIsProfileOpen(false);
    action();
  };

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-3 md:hidden">
      <div className="min-w-0 flex-1">
        <SpaceSwitcher
          variant="mobile"
          selectedSpaceId={selectedSpaceId}
          onSpaceChange={onSpaceChange}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsProfileOpen((current) => !current)}
            aria-label="Account menu"
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className={cn(
              'flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isProfileOpen ? 'ring-2 ring-brand/40' : ''
            )}
          >
            <Avatar className="h-8 w-8 border border-border/60">
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
                className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border bg-popover p-1.5 shadow-e3 animate-in fade-in slide-in-from-top-1 duration-100"
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
    </header>
  );
}
