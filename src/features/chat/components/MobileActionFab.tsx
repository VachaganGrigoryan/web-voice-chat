import { useState } from 'react';
import { Plus, Radio, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileActionFabProps {
  onNewGroup: () => void;
  onNewChannel: () => void;
}

/**
 * Mobile-only expandable "+" FAB. Tapping expands to reveal New group / New
 * channel; a transparent backdrop closes it. Desktop uses ChatActionRail instead.
 */
export function MobileActionFab({ onNewGroup, onNewChannel }: MobileActionFabProps) {
  const [open, setOpen] = useState(false);

  const runAction = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className="md:hidden">
      {open ? (
        <button
          type="button"
          aria-hidden
          className="fixed inset-0 z-30 cursor-default bg-foreground/5"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {open ? (
          <>
            <button
              type="button"
              onClick={() => runAction(onNewChannel)}
              className="flex items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md transition-colors hover:bg-muted"
            >
              <Radio className="h-4 w-4" />
              New channel
            </button>
            <button
              type="button"
              onClick={() => runAction(onNewGroup)}
              className="flex items-center gap-2 rounded-full border bg-background py-2 pl-3 pr-4 text-sm font-medium shadow-md transition-colors hover:bg-muted"
            >
              <Users className="h-4 w-4" />
              New group
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close actions' : 'New conversation'}
          aria-expanded={open}
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg',
            'transition-colors duration-200 hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
