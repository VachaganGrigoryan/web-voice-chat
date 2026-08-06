import { Check, Loader2, UserRound, X } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

export interface ManageJoinRequestRow {
  readonly id: string;
  readonly userId: string;
}

interface RequestsSectionProps {
  requests: readonly ManageJoinRequestRow[];
  isLoading: boolean;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  isMutating?: boolean;
}

/** Pending join requests, approved or rejected one at a time. */
export function RequestsSection({ requests, isLoading, onApprove, onReject, isMutating }: RequestsSectionProps) {
  return (
    <PanelSection title="Join requests" description={requests.length ? `${requests.length} awaiting approval` : undefined}>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
          No pending requests.
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
          {requests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 p-4">
              <Avatar className="h-9 w-9 border border-border/60">
                <AvatarFallback>
                  <UserRound className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{request.userId}</span>
              <Button type="button" size="sm" disabled={isMutating} onClick={() => onApprove(request.id)}>
                <Check className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isMutating} onClick={() => onReject(request.id)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </PanelSection>
  );
}
