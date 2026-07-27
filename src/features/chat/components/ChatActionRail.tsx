import { type ComponentType, useState } from 'react';
import {
  Bell,
  Compass,
  Contact,
  LogOut,
  MessageSquare,
  MessageSquareText,
  Phone,
  Plus,
  Radio,
  Rss,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { User } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import { SpaceSwitcher } from './SpaceSwitcher';

type SidebarView = 'chats' | 'calls' | 'threads';

interface ChatActionRailProps {
  pendingIncomingCount: number;
  sidebarView: SidebarView;
  profile: User | null | undefined;
  userEmail: string | null;
  selectedSpaceId: string | null;
  onSpaceChange: (spaceId: string | null) => void;
  onSelectView: (view: SidebarView) => void;
  onOpenPings: () => void;
  onOpenContacts: () => void;
  onOpenSpaces: () => void;
  onOpenFeeds: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

interface RailButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  showDot?: boolean;
  active?: boolean;
  className?: string;
}

function RailButton({ icon: Icon, label, onClick, showDot = false, active = false, className }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl',
        'transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background hover:text-foreground',
        className
      )}
    >
      <Icon className="h-5 w-5" />
      {showDot ? (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
      ) : null}
    </button>
  );
}

/**
 * Windows-taskbar-style vertical action rail shown to the left of the
 * conversation sidebar on desktop. Hosts the Space switcher (top), the primary
 * view navigation and consolidated creation button (middle), and the user
 * profile menu (bottom).
 */
export function ChatActionRail({
  pendingIncomingCount,
  sidebarView,
  profile,
  userEmail,
  selectedSpaceId,
  onSpaceChange,
  onSelectView,
  onOpenPings,
  onOpenContacts,
  onOpenSpaces,
  onOpenFeeds,
  onNewGroup,
  onNewChannel,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}: ChatActionRailProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileLabel = profile?.display_name || profile?.username || userEmail || 'Account';
  const profileFallback = (profileLabel[0] || '?').toUpperCase();

  const runCreate = (action: () => void) => {
    setIsCreateOpen(false);
    action();
  };

  const runProfile = (action: () => void) => {
    setIsProfileOpen(false);
    action();
  };

  return (
    <nav
      aria-label="Primary actions"
      className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-muted/10 py-3 md:flex"
    >
      <div className="mb-1">
        <SpaceSwitcher
          variant="rail"
          selectedSpaceId={selectedSpaceId}
          onSpaceChange={onSpaceChange}
        />
      </div>

      <RailButton
        icon={Bell}
        label="Pings"
        onClick={onOpenPings}
        showDot={pendingIncomingCount > 0}
      />
      <RailButton icon={Contact} label="Contacts" onClick={onOpenContacts} />
      <RailButton icon={Compass} label="Spaces" onClick={onOpenSpaces} />
      <RailButton icon={Rss} label="Home feed" onClick={onOpenFeeds} />
      <RailButton
        icon={MessageSquare}
        label="Chats"
        onClick={() => onSelectView('chats')}
        active={sidebarView === 'chats'}
      />
      <RailButton
        icon={MessageSquareText}
        label="Threads"
        onClick={() => onSelectView('threads')}
        active={sidebarView === 'threads'}
      />
      <RailButton
        icon={Phone}
        label="Calls"
        onClick={() => onSelectView('calls')}
        active={sidebarView === 'calls'}
      />
      <RailButton icon={UserRound} label="My page" onClick={onOpenProfile} />

      {/* Consolidated creation button */}
      <div className="relative">
        <RailButton
          icon={Plus}
          label="New conversation"
          onClick={() => setIsCreateOpen((current) => !current)}
          active={isCreateOpen}
        />
        {isCreateOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsCreateOpen(false)} />
            <div className="fixed left-[72px] z-50 w-48 rounded-xl border bg-popover p-1.5 shadow-xl shadow-foreground/5 animate-in fade-in slide-in-from-left-1 duration-100">
              <button
                type="button"
                onClick={() => runCreate(onNewGroup)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
              >
                <Users className="h-4 w-4 shrink-0" />
                New Group
              </button>
              <button
                type="button"
                onClick={() => runCreate(onNewChannel)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
              >
                <Radio className="h-4 w-4 shrink-0" />
                New Channel
              </button>
            </div>
          </>
        ) : null}
      </div>

      {/* User profile menu */}
      <div className="relative mt-auto">
        <button
          type="button"
          onClick={() => setIsProfileOpen((current) => !current)}
          title={profileLabel}
          aria-label="Account menu"
          aria-expanded={isProfileOpen}
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-2xl transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
            isProfileOpen ? 'ring-2 ring-primary/40' : 'hover:bg-background'
          )}
        >
          <Avatar className="h-9 w-9 border border-border/60">
            {profile?.avatar?.url ? <AvatarImage src={profile.avatar.url} className="object-cover" /> : null}
            <AvatarFallback>{profileFallback}</AvatarFallback>
          </Avatar>
        </button>
        {isProfileOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
            <div className="fixed bottom-3 left-[72px] z-50 w-48 rounded-xl border bg-popover p-1.5 shadow-xl shadow-foreground/5 animate-in fade-in slide-in-from-left-1 duration-100">
              <button
                type="button"
                onClick={() => runProfile(onOpenProfile)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
              >
                <UserRound className="h-4 w-4 shrink-0" />
                Profile
              </button>
              <button
                type="button"
                onClick={() => runProfile(onOpenSettings)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Settings
              </button>
              <div className="my-1 border-t opacity-40" />
              <button
                type="button"
                onClick={() => runProfile(onLogout)}
                className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Leave
              </button>
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
