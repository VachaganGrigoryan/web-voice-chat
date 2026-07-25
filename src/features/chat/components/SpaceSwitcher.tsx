import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  Plus,
  Link,
  Check,
  Globe,
  Users2,
  UserCheck,
  UserX,
  Clock,
  Sparkles,
  Settings
} from 'lucide-react';
import { spacesApi } from '@/api/endpoints';
import { SpaceView, SpaceJoinRequestView } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { toast } from 'sonner';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES } from '@/app/routes';

type SpaceSwitcherVariant = 'sidebar' | 'rail' | 'mobile';

interface SpaceSwitcherProps {
  selectedSpaceId: string | null;
  onSpaceChange: (spaceId: string | null) => void;
  variant?: SpaceSwitcherVariant;
}

export function SpaceSwitcher({
  selectedSpaceId,
  onSpaceChange,
  variant = 'sidebar',
}: SpaceSwitcherProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);

  // Form states
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [directSpaceSlug, setDirectSpaceSlug] = useState('');

  const queryClient = useQueryClient();

  // Fetch user spaces
  const { data: spaces = [] } = useQuery<SpaceView[]>({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId);

  // Mutation to create space
  const createSpaceMutation = useMutation({
    mutationFn: (data: { name: string; slug: string }) => spacesApi.create(data),
    onSuccess: (newSpace) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setIsCreateOpen(false);
      setNewName('');
      setNewSlug('');
      onSpaceChange(newSpace.id);
    },
  });

  // Mutation to redeem invite
  const redeemInviteMutation = useMutation({
    mutationFn: (code: string) => spacesApi.redeemInvite(code),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      setIsJoinOpen(false);
      setInviteCode('');
      if (res.status === 'joined' && res.space) {
        onSpaceChange(res.space.id);
        toast.success('Successfully joined the space!');
      } else {
        toast.info('Join request submitted and pending approval!');
      }
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to redeem invite link.'));
    }
  });

  // Mutation to request direct join (ping-to-org)
  const joinSpaceMutation = useMutation({
    mutationFn: (spaceId: string) => spacesApi.join(spaceId),
    onSuccess: () => {
      toast.success('Request to join submitted!');
      setIsJoinOpen(false);
      setDirectSpaceSlug('');
    },
    onError: (err: any) => {
      toast.error(extractApiError(err, 'Failed to submit request.'));
    }
  });

  // Fetch pending requests for selected space
  const { data: joinRequests = [], refetch: refetchRequests } = useQuery<SpaceJoinRequestView[]>({
    queryKey: ['join-requests', selectedSpaceId],
    queryFn: () => selectedSpaceId ? spacesApi.listJoinRequests(selectedSpaceId) : Promise.resolve([]),
    enabled: !!selectedSpaceId && isRequestsOpen,
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      selectedSpaceId ? spacesApi.approveJoinRequest(selectedSpaceId, requestId) : Promise.reject(),
    onSuccess: () => {
      refetchRequests();
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    }
  });

  // Reject request mutation
  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      selectedSpaceId ? spacesApi.rejectJoinRequest(selectedSpaceId, requestId) : Promise.reject(),
    onSuccess: () => {
      refetchRequests();
    }
  });

  const handleCreateSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newSlug.trim()) return;
    createSpaceMutation.mutate({ name: newName, slug: newSlug });
  };

  const handleJoinSpace = (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteCode.trim()) {
      redeemInviteMutation.mutate(inviteCode.trim());
    } else if (directSpaceSlug.trim()) {
      // To support ping-to-org, the user inputs the space ID/slug.
      joinSpaceMutation.mutate(directSpaceSlug.trim());
    }
  };

  // Shared dropdown body used by every variant.
  const dropdownContent = (
    <>
      <div className="max-h-60 overflow-y-auto">
        {/* Global chats entry */}
        <button
          onClick={() => {
            onSpaceChange(null);
            setIsOpen(false);
          }}
          className={cn(
            "flex w-full items-center justify-between rounded-lg p-2 text-xs font-medium transition-colors",
            selectedSpaceId === null
              ? "bg-primary/10 text-primary"
              : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 opacity-80" />
            <span>Global Chats</span>
          </div>
          {selectedSpaceId === null && <Check className="h-3.5 w-3.5" />}
        </button>

        <div className="my-1.5 border-t opacity-40" />

        {/* Spaces list */}
        {spaces.length === 0 ? (
          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
            No spaces joined yet
          </div>
        ) : (
          spaces.map(space => (
            <button
              key={space.id}
              onClick={() => {
                onSpaceChange(space.id);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg p-2 text-xs font-medium transition-colors mb-0.5",
                selectedSpaceId === space.id
                  ? "bg-primary/10 text-primary"
                  : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground uppercase border">
                  {space.name[0]}
                </div>
                <span className="truncate">{space.name}</span>
              </div>
              {selectedSpaceId === space.id && <Check className="h-3.5 w-3.5" />}
            </button>
          ))
        )}
      </div>

      <div className="my-1.5 border-t opacity-40" />

      {/* Quick Actions */}
      <div className="flex flex-col gap-0.5">
        {selectedSpaceId && (
          <button
            onClick={() => {
              setIsRequestsOpen(true);
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
          >
            <Users2 className="h-4 w-4 shrink-0 text-indigo-500" />
            <span>Space Join Requests</span>
          </button>
        )}
        <button
          onClick={() => {
            setIsCreateOpen(true);
            setIsOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
        >
          <Plus className="h-4 w-4 shrink-0 text-emerald-500" />
          <span>Create a Space</span>
        </button>
        <button
          onClick={() => {
            setIsJoinOpen(true);
            setIsOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
        >
          <Link className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Join Space / Enter Invite</span>
        </button>
        <button
          onClick={() => {
            setIsOpen(false);
            navigate(APP_ROUTES.spaces);
          }}
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-xs font-medium text-foreground/80 hover:bg-muted/60 hover:text-foreground"
        >
          <Settings className="h-4 w-4 shrink-0 text-blue-500" />
          <span>Manage Spaces</span>
        </button>
      </div>
    </>
  );

  // Modal dialogs shared across every variant.
  const dialogs = (
    <>
      {/* Create Space Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Create a Space
            </DialogTitle>
            <DialogDescription>
              Spaces help group your conversations, channels, and members under a shared workspace.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSpace}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="space-name">Space Name</Label>
                <Input
                  id="space-name"
                  placeholder="e.g. Acme Corporation"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="space-slug">Space URL Slug</Label>
                <Input
                  id="space-slug"
                  placeholder="e.g. acme-corp"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSpaceMutation.isPending}>
                {createSpaceMutation.isPending ? 'Creating...' : 'Create Space'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Space Dialog */}
      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5 text-amber-500" />
              Join a Space
            </DialogTitle>
            <DialogDescription>
              Enter an invite code to join a space, or input a space ID/slug to request direct access.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinSpace}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="invite-code">Redeem Invite Code</Label>
                <Input
                  id="invite-code"
                  placeholder="e.g. ABCD-1234"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  disabled={!!directSpaceSlug}
                />
              </div>
              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <span className="relative bg-background px-2 text-xs text-muted-foreground uppercase">Or</span>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="direct-slug">Direct Join Request (Space ID or Slug)</Label>
                <Input
                  id="direct-slug"
                  placeholder="e.g. acme-corp"
                  value={directSpaceSlug}
                  onChange={(e) => setDirectSpaceSlug(e.target.value)}
                  disabled={!!inviteCode}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={redeemInviteMutation.isPending || joinSpaceMutation.isPending}
              >
                {redeemInviteMutation.isPending || joinSpaceMutation.isPending ? 'Joining...' : 'Submit'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Space Join Requests Dialog */}
      <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-500" />
              Join Requests for {selectedSpace?.name}
            </DialogTitle>
            <DialogDescription>
              Review and approve pending requests to join this space.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-80 overflow-y-auto">
            {joinRequests.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No pending join requests
              </div>
            ) : (
              <div className="space-y-3">
                {joinRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between border p-3 rounded-lg bg-muted/30">
                    <div className="min-w-0 flex-1 pr-3">
                      <p className="text-xs font-semibold truncate text-foreground">User ID: {req.user_id}</p>
                      <p className="text-[10px] text-muted-foreground">Requested: {new Date(req.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => approveMutation.mutate(req.id)}
                        disabled={approveMutation.isPending}
                        title="Approve"
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/5"
                        onClick={() => rejectMutation.mutate(req.id)}
                        disabled={rejectMutation.isPending}
                        title="Reject"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setIsRequestsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  const spaceInitial = selectedSpace ? selectedSpace.name[0].toUpperCase() : null;

  // Compact icon trigger shared by rail (desktop) and mobile header. Opens a
  // floating panel anchored below the button.
  if (variant === 'rail' || variant === 'mobile') {
    const isRail = variant === 'rail';
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          title={selectedSpace ? selectedSpace.name : 'Global Chats'}
          aria-label="Switch space"
          aria-expanded={isOpen}
          className={cn(
            "flex shrink-0 items-center justify-center text-white font-semibold transition-all",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            isRail ? "h-11 w-11 rounded-2xl text-sm" : "h-9 w-9 rounded-xl text-xs",
            selectedSpace
              ? "bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md shadow-indigo-500/10"
              : "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/10",
            isOpen && "ring-2 ring-primary/40"
          )}
        >
          {spaceInitial ?? <Globe className={isRail ? "h-5 w-5" : "h-4 w-4"} />}
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div
              className={cn(
                "z-50 w-64 rounded-xl border bg-popover p-1.5 shadow-xl shadow-foreground/5 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-100",
                isRail ? "fixed left-[72px] top-3" : "absolute left-0 top-full mt-1.5"
              )}
            >
              {dropdownContent}
            </div>
          </>
        )}

        {dialogs}
      </div>
    );
  }

  return (
    <div className="relative w-full px-4 pt-3">
      {/* Selector trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-xl border bg-background/50 p-2.5 text-sm font-medium transition-all duration-200 backdrop-blur-sm",
          "hover:bg-muted/50 hover:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/20",
          isOpen && "border-primary/40 bg-muted/30"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white font-semibold text-xs",
            selectedSpace
              ? "bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-md shadow-indigo-500/10"
              : "bg-gradient-to-tr from-emerald-500 to-teal-500 shadow-md shadow-emerald-500/10"
          )}>
            {selectedSpace ? selectedSpace.name[0].toUpperCase() : <Globe className="h-4 w-4" />}
          </div>
          <span className="truncate text-left text-foreground/90 font-semibold">
            {selectedSpace ? selectedSpace.name : 'Global Chats'}
          </span>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-4 right-4 mt-1.5 z-50 rounded-xl border bg-popover p-1.5 shadow-xl shadow-foreground/5 backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-100">
            {dropdownContent}
          </div>
        </>
      )}

      {dialogs}
    </div>
  );
}
