import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpaces } from '@/hooks/useSpaces';
import { ROLE_ADMIN } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useAppNavigation } from '@/navigation/appNavigation';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Plus, Compass, Users, Settings, LogIn, ShieldAlert, Radio, Globe, Lock } from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';

export default function SpacesPage() {
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();
  const { spaces, isLoadingSpaces, createSpace, isCreatingSpace, redeemInvite, isRedeemingInvite } = useSpaces();

  // Create Space Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [spaceName, setSpaceName] = useState('');
  const [spaceSlug, setSpaceSlug] = useState('');
  const [spaceKind, setSpaceKind] = useState<'org' | 'workspace' | 'subspace'>('workspace');
  const [spaceVisibility, setSpaceVisibility] = useState<'public' | 'private'>('public');

  // Join by Code Dialog State
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spaceName || !spaceSlug) return;
    try {
      await createSpace({
        name: spaceName,
        slug: spaceSlug,
        kind: spaceKind,
        visibility: spaceVisibility,
      });
      setIsCreateOpen(false);
      setSpaceName('');
      setSpaceSlug('');
    } catch (err) {
      // toast is already handled in mutation
    }
  };

  const handleJoinSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode) return;
    try {
      await redeemInvite(inviteCode);
      setIsJoinOpen(false);
      setInviteCode('');
    } catch (err) {
      // toast is already handled in mutation
    }
  };

  const userId = useAuthStore((state) => state.userId);

  // Group spaces
  const managedSpaces = spaces.filter(
    (s) => s.owner_user_id === userId || s.viewer_role === ROLE_ADMIN
  );
  const joinedSpaces = spaces.filter(
    (s) => s.owner_user_id !== userId && s.viewer_role !== ROLE_ADMIN
  );

  const headerActions = (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="flex items-center gap-1.5 rounded-xl border-border/70 hover:bg-muted"
        onClick={() => setIsJoinOpen(true)}
      >
        <LogIn className="h-4 w-4" />
        <span>Join by Code</span>
      </Button>
      <Button
        size="sm"
        className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95"
        onClick={() => setIsCreateOpen(true)}
      >
        <Plus className="h-4 w-4" />
        <span>Create Space</span>
      </Button>
    </div>
  );

  return (
    <PanelPageLayout
      title="Spaces"
      description="Collaborate in secure spaces, workspace-scoped channels, and invite-only voice rooms."
      onBack={() => goBack()}
      headerActions={headerActions}
    >
      <div className="space-y-8">
        {isLoadingSpaces ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : spaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 p-12 text-center bg-card/50 backdrop-blur-sm">
            <Compass className="h-12 w-12 text-muted-foreground/60 mb-4" />
            <h3 className="text-lg font-semibold tracking-tight">No Spaces Found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Spaces allow you to organize your channels, groups, and members. Create a new one or ask a manager for an invite code.
            </p>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => setIsJoinOpen(true)} variant="outline" className="rounded-xl">
                Join Space
              </Button>
              <Button onClick={() => setIsCreateOpen(true)} className="rounded-xl">
                Create a Space
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Managed Spaces */}
            {managedSpaces.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    Managed by You
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {managedSpaces.map((s) => (
                    <Card
                      key={s.id}
                      className="group cursor-pointer border-border/60 hover:border-primary/50 bg-background/50 hover:bg-card/75 transition-all duration-300 rounded-2xl shadow-sm overflow-hidden"
                      onClick={() => navigate(APP_ROUTES.spaceDetailTab(s.id, 'channels'))}
                    >
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="text-base group-hover:text-primary transition-colors">
                              {s.name}
                            </CardTitle>
                            <CardDescription className="text-xs font-mono text-muted-foreground/80">
                              /{s.slug}
                            </CardDescription>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                            {s.viewer_role}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 py-0 pb-4">
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md">
                            {s.kind === 'org' ? (
                              <Users className="h-3 w-3" />
                            ) : s.kind === 'workspace' ? (
                              <Radio className="h-3 w-3" />
                            ) : (
                              <Compass className="h-3 w-3" />
                            )}
                            {s.kind}
                          </span>
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md">
                            {s.visibility === 'public' ? (
                              <Globe className="h-3 w-3" />
                            ) : (
                              <Lock className="h-3 w-3" />
                            )}
                            {s.visibility}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="px-5 py-3 bg-muted/30 border-t border-border/40 flex justify-end">
                        <span className="text-xs font-medium text-primary group-hover:underline">
                          Manage Space →
                        </span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Joined Spaces */}
            {joinedSpaces.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                    Joined Spaces
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {joinedSpaces.map((s) => (
                    <Card
                      key={s.id}
                      className="group cursor-pointer border-border/60 hover:border-primary/50 bg-background/50 hover:bg-card/75 transition-all duration-300 rounded-2xl shadow-sm overflow-hidden"
                      onClick={() => navigate(APP_ROUTES.spaceDetailTab(s.id, 'channels'))}
                    >
                      <CardHeader className="p-5 pb-3">
                        <div className="space-y-1">
                          <CardTitle className="text-base group-hover:text-primary transition-colors">
                            {s.name}
                          </CardTitle>
                          <CardDescription className="text-xs font-mono text-muted-foreground/80">
                            /{s.slug}
                          </CardDescription>
                        </div>
                      </CardHeader>
                      <CardContent className="px-5 py-0 pb-4">
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md">
                            {s.kind}
                          </span>
                          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground bg-muted/65 px-2 py-0.5 rounded-md">
                            {s.visibility}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="px-5 py-3 bg-muted/30 border-t border-border/40 flex justify-end">
                        <span className="text-xs font-medium text-primary group-hover:underline">
                          Enter Space →
                        </span>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create Space Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Create a New Space</DialogTitle>
            <DialogDescription>
              Spaces help group your teammates and manage access to channels and voice rooms.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSpace} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="space-name">Space Name</Label>
              <Input
                id="space-name"
                value={spaceName}
                onChange={(e) => {
                  setSpaceName(e.target.value);
                  setSpaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                }}
                placeholder="e.g. Acme Corporation"
                required
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="space-slug">Space Slug (URL path)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-mono">/</span>
                <Input
                  id="space-slug"
                  value={spaceSlug}
                  onChange={(e) => setSpaceSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="acme-corp"
                  className="pl-6 font-mono"
                  required
                  maxLength={30}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="space-kind">Kind</Label>
                <select
                  id="space-kind"
                  value={spaceKind}
                  onChange={(e) => setSpaceKind(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="workspace">Workspace</option>
                  <option value="org">Organization</option>
                  <option value="subspace">Subspace</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="space-visibility">Visibility</Label>
                <select
                  id="space-visibility"
                  value={spaceVisibility}
                  onChange={(e) => setSpaceVisibility(e.target.value as any)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="public">Public (anyone can join)</option>
                  <option value="private">Private (requires approval)</option>
                </select>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreatingSpace}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingSpace}>
                {isCreatingSpace ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Join Space Dialog */}
      <Dialog open={isJoinOpen} onOpenChange={setIsJoinOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Join a Space</DialogTitle>
            <DialogDescription>
              Enter a space invitation code below to join or request membership.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleJoinSpace} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="invite-code">Invitation Code</Label>
              <Input
                id="invite-code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.trim())}
                placeholder="e.g. sp_abc123xyz"
                required
                className="font-mono text-center tracking-wider text-base"
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsJoinOpen(false)} disabled={isRedeemingInvite}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRedeemingInvite}>
                {isRedeemingInvite ? 'Joining...' : 'Join Space'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PanelPageLayout>
  );
}
