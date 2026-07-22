import type { ComponentType } from 'react';
import { Bell, Radio, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatActionRailProps {
  pendingIncomingCount: number;
  onOpenPings: () => void;
  onNewGroup: () => void;
  onNewChannel: () => void;
}

interface RailButtonProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  showDot?: boolean;
}

function RailButton({ icon: Icon, label, onClick, showDot = false }: RailButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl',
        'text-muted-foreground transition-colors duration-200',
        'hover:bg-background hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted'
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
 * conversation sidebar on desktop. Hosts the primary global actions; owns no
 * dialog state (triggers are lifted to ChatLayout).
 */
export function ChatActionRail({
  pendingIncomingCount,
  onOpenPings,
  onNewGroup,
  onNewChannel,
}: ChatActionRailProps) {
  return (
    <nav
      aria-label="Primary actions"
      className="hidden w-[68px] shrink-0 flex-col items-center gap-1 border-r bg-muted/10 py-3 md:flex"
    >
      <RailButton
        icon={Bell}
        label="Pings"
        onClick={onOpenPings}
        showDot={pendingIncomingCount > 0}
      />
      <RailButton icon={Users} label="New group" onClick={onNewGroup} />
      <RailButton icon={Radio} label="New channel" onClick={onNewChannel} />
    </nav>
  );
}
