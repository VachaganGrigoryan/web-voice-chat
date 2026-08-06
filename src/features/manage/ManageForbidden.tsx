import { ShieldAlert } from 'lucide-react';

interface ManageForbiddenProps {
  resourceLabel: string;
}

/**
 * The explicit not-permitted state for a management route. Never a blank page,
 * never a silent redirect — a viewer who lacks `resource.manage` sees exactly
 * why, with the page's own back arrow (from `PanelPageLayout`) as the way out.
 */
export function ManageForbidden({ resourceLabel }: ManageForbiddenProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h2 className="text-base font-semibold text-foreground">You can't manage this {resourceLabel}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Managing a {resourceLabel} is limited to its owner and admins. Ask one of them for access, or go back.
      </p>
    </div>
  );
}
