import { useState } from 'react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmDestructiveActionDialog } from '@/features/chat/components/ConfirmDestructiveActionDialog';

export interface ManageDangerAction {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly confirmTitle: string;
  readonly confirmDescription: string;
  readonly onConfirm: () => void | Promise<void>;
  readonly isPending?: boolean;
  /** When set, this phrase must be typed exactly before the action is accepted. */
  readonly confirmPhrase?: string | null;
}

interface DangerSectionProps {
  actions: readonly ManageDangerAction[];
}

/**
 * Destructive actions, confirmed one at a time through a shared dialog. Each
 * `ManageXPage` supplies whatever actions actually exist for that resource
 * type today — several resource types have none yet (e.g. no delete-space
 * endpoint), in which case this reads as "nothing available" rather than
 * disappearing, so the gap is visible instead of silent.
 */
export function DangerSection({ actions }: DangerSectionProps) {
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const pendingAction = actions.find((action) => action.id === pendingActionId) ?? null;

  return (
    <PanelSection title="Danger zone" description="Irreversible actions.">
      <ConfirmDestructiveActionDialog
        open={!!pendingAction}
        title={pendingAction?.confirmTitle ?? ''}
        description={pendingAction?.confirmDescription ?? ''}
        actionLabel={pendingAction?.label ?? ''}
        confirmPhrase={pendingAction?.confirmPhrase ?? null}
        isPending={!!pendingAction?.isPending}
        onOpenChange={(open) => {
          if (!open && !pendingAction?.isPending) setPendingActionId(null);
        }}
        onConfirm={async () => {
          await pendingAction?.onConfirm();
          setPendingActionId(null);
        }}
      />

      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No destructive actions are available here yet.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-destructive/30">
          {actions.map((action) => (
            <div key={action.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setPendingActionId(action.id)}
              >
                {action.label}
              </Button>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}
