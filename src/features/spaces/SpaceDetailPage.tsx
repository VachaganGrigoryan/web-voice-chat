import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useSpaces } from '@/hooks/useSpaces';
import { ROLE_ADMIN } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useAppNavigation } from '@/navigation/appNavigation';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Radio,
  Users,
  Link,
  ShieldAlert,
  Settings,
  Trash2,
  Check,
  X,
  RadioTower,
  Globe,
  Lock,
  Search,
  UserPlus,
} from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';

export default function SpaceDetailPage() {
  const myUserId = useAuthStore((state) => state.userId);
  const { spaceId, tab = 'channels' } = useParams<{ spaceId: string; tab?: string }>();
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();

  const {
    space,
    isLoadingSpace,
    members,
    isLoadingMembers,
    roles,
    channels,
    isLoadingChannels,
    invites,
    isLoadingInvites,
    joinRequests,
    isLoadingJoinRequests,
    // Mutations
    updateSpace,
    isUpdatingSpace,
    createInvite,
    isCreatingInvite,
    inviteUser,
    isInvitingUser,
    revokeInvite,
    approveRequest,
    rejectRequest,
    joinChannel,
    assignMemberRoles,
    isAssigningMemberRoles,
  } = useSpaces(spaceId || '');

  // Search filter for members
  const [memberSearch, setMemberSearch] = useState('');

  // Dialog States
  const [isInviteUserOpen, setIsInviteUserOpen] = useState(false);
  const [inviteeUserId, setInviteeUserId] = useState('');

  // Space Settings Form State
  const [editName, setEditName] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'private'>('public');

  // Initialize Settings Form when space details load
  useEffect(() => {
    if (space) {
      setEditName(space.name);
      setEditVisibility(space.visibility);
    }
  }, [space]);

  if (!spaceId) {
    return <Navigate to={APP_ROUTES.spaces} replace />;
  }

  const isOwner = !!(space && myUserId && space.owner_user_id === myUserId);
  const isManager = isOwner || space?.viewer_role === ROLE_ADMIN;

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteeUserId) return;
    try {
      await inviteUser({ spaceId, userId: inviteeUserId });
      setIsInviteUserOpen(false);
      setInviteeUserId('');
    } catch (err) {
      // Handled in mutation
    }
  };

  const handleUpdateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSpace({
        spaceId,
        data: {
          name: editName || space?.name,
          visibility: editVisibility,
        },
      });
    } catch (err) {
      // Handled in mutation
    }
  };

  if (isLoadingSpace) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center p-4 bg-background">
        <h3 className="text-lg font-semibold">Space not found</h3>
        <Button onClick={() => goBack()} className="mt-4 rounded-xl">
          Go Back
        </Button>
      </div>
    );
  }

  const filteredMembers = members.filter(
    (m) =>
      m.user?.display_name?.toLowerCase().includes(memberSearch.toLowerCase()) ||
      m.user?.username?.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <PanelPageLayout
      title={space.name}
      description={`/${space.slug} • ${space.kind.toUpperCase()}`}
      onBack={() => goBack()}
      nav={
        <div className="flex gap-1">
          <Button
            variant={tab === 'channels' ? 'default' : 'ghost'}
            className="rounded-xl px-4 h-9"
            onClick={() => navigate(`/spaces/${spaceId}/channels`)}
          >
            <RadioTower className="h-4 w-4 mr-2" />
            Channels
          </Button>
          <Button
            variant={tab === 'members' ? 'default' : 'ghost'}
            className="rounded-xl px-4 h-9"
            onClick={() => navigate(`/spaces/${spaceId}/members`)}
          >
            <Users className="h-4 w-4 mr-2" />
            Members ({members.length})
          </Button>
          {isManager && (
            <>
              <Button
                variant={tab === 'invites' ? 'default' : 'ghost'}
                className="rounded-xl px-4 h-9"
                onClick={() => navigate(`/spaces/${spaceId}/invites`)}
              >
                <Link className="h-4 w-4 mr-2" />
                Invites
              </Button>
              <Button
                variant={tab === 'requests' ? 'default' : 'ghost'}
                className="rounded-xl px-4 h-9"
                onClick={() => navigate(`/spaces/${spaceId}/requests`)}
              >
                <ShieldAlert className="h-4 w-4 mr-2" />
                Requests ({joinRequests.length})
              </Button>
              <Button
                variant={tab === 'settings' ? 'default' : 'ghost'}
                className="rounded-xl px-4 h-9"
                onClick={() => navigate(`/spaces/${spaceId}/settings`)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Channels Tab */}
        {tab === 'channels' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">Channels in this space</h3>
            </div>

            {isLoadingChannels ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/70 rounded-2xl bg-card/30">
                <RadioTower className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No channels created in this space yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {channels.map((chan) => (
                  <Card key={chan.id} className="border-border/60 hover:border-primary/45 transition-colors duration-200 rounded-2xl bg-background/50">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">#{chan.title}</span>
                          <span className="inline-flex text-3xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {chan.space_visibility?.replace('_', ' ') || 'public'}
                          </span>
                        </div>
                        {chan.description && (
                          <p className="text-xs text-muted-foreground truncate">{chan.description}</p>
                        )}
                      </div>
                      <div className="shrink-0">
                        {chan.joined ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                            onClick={() => navigate(APP_ROUTES.channel(chan.id))}
                          >
                            Open
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="rounded-xl text-xs font-semibold"
                            onClick={() => joinChannel({ spaceId, conversationId: chan.id })}
                          >
                            Join
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Members Tab */}
        {tab === 'members' && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search space members..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="pl-9 rounded-xl border-border/70"
              />
            </div>

            {isLoadingMembers ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                No members found matching "{memberSearch}"
              </div>
            ) : (
              <div className="border border-border/70 rounded-2xl bg-card/25 backdrop-blur-sm divide-y divide-border/60 overflow-hidden">
                {filteredMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 px-4 text-sm hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                        {m.user?.display_name?.[0]?.toUpperCase() || m.user?.username?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">
                          {m.user?.display_name || m.user?.username || 'Unknown'}
                        </p>
                        {m.user?.username && (
                          <p className="text-xs text-muted-foreground truncate">@{m.user.username}</p>
                        )}
                      </div>
                    </div>
                    {isManager && space?.owner_user_id !== m.user_id ? (
                      <select
                        aria-label={`Role for ${m.user?.display_name || m.user?.username || 'member'}`}
                        className="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                        disabled={isAssigningMemberRoles}
                        value={roles.find((role) => role.name === m.role)?.id || ''}
                        onChange={(event) => {
                          void assignMemberRoles({
                            relationshipId: m.id,
                            roleIds: [event.target.value],
                          });
                        }}
                      >
                        <option value="" disabled>
                          {m.role || 'Select role'}
                        </option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                        space?.owner_user_id === m.user_id
                          ? 'bg-red-500/10 text-red-500 border border-red-500/25'
                          : m.role === ROLE_ADMIN
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        {m.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Invites Tab (Manager-only) */}
        {tab === 'invites' && isManager && (
          <div className="space-y-6">
            <PanelSection
              title="Space Direct Invite"
              description="Invite an existing user directly to this space."
              action={
                <Button size="sm" className="rounded-xl flex items-center gap-1.5" onClick={() => setIsInviteUserOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                  <span>Invite User</span>
                </Button>
              }
            >
              <p className="text-xs text-muted-foreground">
                Direct invites create single-use targeted invitations and notify the user instantly via the App.
              </p>
            </PanelSection>

            <PanelSection
              title="Invite Links"
              description="Generate sharing links that grant access to this space."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-border/70"
                  onClick={() => createInvite({ spaceId, data: { requires_approval: false } })}
                  disabled={isCreatingInvite}
                >
                  {isCreatingInvite ? 'Creating...' : 'Create Invite Link'}
                </Button>
              }
            >
              {isLoadingInvites ? (
                <div className="flex h-24 items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : invites.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  No invite links created.
                </div>
              ) : (
                <div className="border border-border/70 rounded-2xl bg-card/25 divide-y divide-border/60 overflow-hidden">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3.5 px-4 gap-4 hover:bg-muted/10">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded select-all">
                            {inv.code}
                          </code>
                          <span className="text-2xs text-muted-foreground">
                            {inv.uses} uses
                          </span>
                          {inv.invitee_id && (
                            <span className="inline-flex text-3xs font-semibold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              Targeted
                            </span>
                          )}
                        </div>
                        <p className="text-3xs text-muted-foreground">
                          Created by: {inv.created_by.slice(0, 10)}... • Created at: {new Date(inv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => revokeInvite({ spaceId, inviteId: inv.id })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </PanelSection>
          </div>
        )}

        {/* Requests Tab (Manager-only) */}
        {tab === 'requests' && isManager && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold tracking-tight">Pending Join Requests</h3>

            {isLoadingJoinRequests ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/70 rounded-2xl bg-card/30">
                <ShieldAlert className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No pending join requests.</p>
              </div>
            ) : (
              <div className="border border-border/70 rounded-2xl bg-card/25 overflow-hidden divide-y divide-border/60">
                {joinRequests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3.5 px-4 text-sm hover:bg-muted/10">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">User ID: {req.user_id}</p>
                      <p className="text-3xs text-muted-foreground">
                        Requested: {new Date(req.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 rounded-lg text-destructive hover:bg-destructive/10 hover:border-destructive/35"
                        onClick={() => rejectRequest({ spaceId, requestId: req.id })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => approveRequest({ spaceId, requestId: req.id })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings Tab (Manager-only) */}
        {tab === 'settings' && isManager && (
          <PanelSection
            title="Space Settings"
            description="Manage the configuration of your space."
          >
            <form onSubmit={handleUpdateSpace} className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Space Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  maxLength={50}
                  className="rounded-xl border-border/70"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-visibility">Visibility</Label>
                <select
                  id="edit-visibility"
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div className="pt-2">
                <Button type="submit" disabled={isUpdatingSpace} className="rounded-xl">
                  {isUpdatingSpace ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            </form>
          </PanelSection>
        )}
      </div>

      {/* Invite User Dialog */}
      <Dialog open={isInviteUserOpen} onOpenChange={setIsInviteUserOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Invite Teammate</DialogTitle>
            <DialogDescription>
              Enter the exact User ID to send a direct space invitation.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteUser} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invitee-user-id">User ID</Label>
              <Input
                id="invitee-user-id"
                value={inviteeUserId}
                onChange={(e) => setInviteeUserId(e.target.value.trim())}
                placeholder="24-character hex ID"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsInviteUserOpen(false)} disabled={isInvitingUser}>
                Cancel
              </Button>
              <Button type="submit" disabled={isInvitingUser}>
                {isInvitingUser ? 'Inviting...' : 'Send Invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PanelPageLayout>
  );
}
