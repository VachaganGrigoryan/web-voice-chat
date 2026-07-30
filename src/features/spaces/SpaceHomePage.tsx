import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useSpaces } from '@/hooks/useSpaces';
import { ROLE_ADMIN } from '@/api/types';
import type { ChannelVisibility } from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { useActiveSpace } from '@/app/shell/useActiveSpace';
import { CreateChannelDialog } from '@/features/chat/components/CreateChannelDialog';
import { useAppNavigation } from '@/navigation/appNavigation';
import { PanelPageLayout } from '@/components/panel/PanelPageLayout';
import { PageTabs } from '@/components/page/PageTabs';
import { PageTab } from '@/components/page/pageTypes';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
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
import {
  Users,
  RadioTower,
  Search,
  MessagesSquare,
  Plus,
  Settings,
  UserPlus,
} from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';

type SpaceHomeTab = 'channels' | 'groups' | 'members';

/**
 * A space's home: what it contains and who's in it. Administration — roles,
 * invites, join requests, settings — lives on its own route subtree now, see
 * `ManageSpacePage`; this page only reads.
 */
export default function SpaceHomePage() {
  const myUserId = useAuthStore((state) => state.userId);
  const { spaceId, tab = 'channels' } = useParams<{ spaceId: string; tab?: string }>();
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();

  const {
    space,
    isLoadingSpace,
    members,
    isLoadingMembers,
    channels,
    isLoadingChannels,
    groups,
    isLoadingGroups,
    joinChannel,
    createGroup,
    isCreatingGroup,
    joinSpace,
    isJoiningSpace,
  } = useSpaces(spaceId || '');

  const [memberSearch, setMemberSearch] = useState('');
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupParticipantIds, setGroupParticipantIds] = useState<string[]>([]);

  const setActiveSpaceId = useActiveSpace((state) => state.setActiveSpaceId);
  // The URL is the source of truth for which space is active; this only
  // syncs the puck store one-way so the rail reflects the space you're on.
  useEffect(() => {
    if (spaceId) setActiveSpaceId(spaceId);
  }, [spaceId, setActiveSpaceId]);

  if (!spaceId) {
    return <Navigate to={APP_ROUTES.spaces} replace />;
  }

  const isOwner = !!(space && myUserId && space.owner_user_id === myUserId);
  const isManager = isOwner || space?.viewer_role === ROLE_ADMIN;
  const isMember = isOwner || !!space?.viewer_role;

  if (isLoadingSpace) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!space) {
    return (
      <div className="flex flex-col h-full min-h-0 w-full items-center justify-center p-4 bg-background">
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

  const spaceTabs: readonly PageTab[] = [
    { id: 'channels', label: 'Channels', icon: RadioTower, count: channels.length },
    { id: 'groups', label: 'Groups', icon: MessagesSquare, count: groups.length },
    { id: 'members', label: 'Members', icon: Users, count: members.length },
  ];

  return (
    <PanelPageLayout
      title={space.name}
      description={`/${space.slug} • ${space.kind.toUpperCase()}`}
      onBack={() => goBack()}
      nav={
        <PageTabs
          tabs={spaceTabs}
          activeTabId={tab as SpaceHomeTab}
          onSelect={(tabId) => navigate(APP_ROUTES.spaceDetailTab(spaceId, tabId as SpaceHomeTab))}
          aria-label="Space sections"
        />
      }
      headerActions={
        <div className="flex items-center gap-2">
          {!isMember && !space.is_default ? (
            <Button size="sm" className="rounded-xl" disabled={isJoiningSpace} onClick={() => void joinSpace(spaceId)}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              {isJoiningSpace ? 'Joining...' : 'Join space'}
            </Button>
          ) : null}
          {isManager ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => navigate(APP_ROUTES.spaceManage(spaceId))}
            >
              <Settings className="mr-1.5 h-4 w-4" />
              Manage
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {tab === 'channels' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">Channels in this space</h3>
              {isManager && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-border/70"
                  onClick={() => setIsCreateChannelOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Channel
                </Button>
              )}
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
                          <span className="font-semibold text-sm truncate">#{chan.name}</span>
                          <span className="inline-flex text-3xs font-semibold uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {chan.visibility}
                          </span>
                        </div>
                        {chan.description && (
                          <p className="text-xs text-muted-foreground truncate">{chan.description}</p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                          onClick={() => navigate(APP_ROUTES.spaceChannel(spaceId, chan.id))}
                        >
                          Open
                        </Button>
                        {!chan.joined && chan.visibility !== 'private' && (
                          <Button
                            size="sm"
                            className="rounded-xl text-xs font-semibold"
                            onClick={() => joinChannel({ spaceId, channelId: chan.id })}
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

        {tab === 'groups' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold tracking-tight">Groups in this space</h3>
              {isManager && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl border-border/70"
                  onClick={() => setIsCreateGroupOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Group
                </Button>
              )}
            </div>

            {isLoadingGroups ? (
              <div className="flex h-24 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border/70 rounded-2xl bg-card/30">
                <MessagesSquare className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No groups created in this space yet.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((group) => (
                  <Card key={group.id} className="border-border/60 rounded-2xl bg-background/50">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="font-semibold text-sm truncate block">
                          {group.title || 'Untitled group'}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {group.participant_count} member
                          {group.participant_count === 1 ? '' : 's'}
                          {!group.joined && ' • you are not a participant'}
                        </p>
                      </div>
                      {group.joined && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-muted"
                          onClick={() => navigate(APP_ROUTES.spaceGroupChat(spaceId, group.id))}
                        >
                          Open
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

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
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider ${
                        space?.owner_user_id === m.user_id
                          ? 'bg-red-500/10 text-red-500 border border-red-500/25'
                          : m.role === ROLE_ADMIN
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                            : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {space?.owner_user_id === m.user_id ? 'Owner' : m.role}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateChannelDialog
        open={isCreateChannelOpen}
        onOpenChange={setIsCreateChannelOpen}
        selectedSpaceId={spaceId}
        onCreated={(channelId) => {
          navigate(APP_ROUTES.spaceChannel(spaceId, channelId));
        }}
      />

      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
            <DialogDescription>
              Participants must already be members of this space.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const group = await createGroup({
                spaceId,
                data: { title: groupTitle.trim(), participant_ids: groupParticipantIds },
              });
              setIsCreateGroupOpen(false);
              setGroupTitle('');
              setGroupParticipantIds([]);
              navigate(APP_ROUTES.spaceGroupChat(spaceId, group.id));
            }}
            className="space-y-4 py-2"
          >
            <div className="space-y-2">
              <Label htmlFor="group-title">Title</Label>
              <Input
                id="group-title"
                value={groupTitle}
                onChange={(e) => setGroupTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Participants</Label>
              <div className="max-h-44 overflow-y-auto border border-border/70 rounded-xl divide-y divide-border/60">
                {members
                  .filter((m) => m.user_id !== myUserId)
                  .map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 p-2.5 text-sm hover:bg-muted/10 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={groupParticipantIds.includes(m.user_id)}
                        onChange={(e) =>
                          setGroupParticipantIds((prev) =>
                            e.target.checked
                              ? [...prev, m.user_id]
                              : prev.filter((id) => id !== m.user_id)
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-border"
                      />
                      <span className="truncate">
                        {m.user?.display_name || m.user?.username || m.user_id}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateGroupOpen(false)}
                disabled={isCreatingGroup}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreatingGroup || groupParticipantIds.length === 0}
              >
                {isCreatingGroup ? 'Creating...' : 'Create Group'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PanelPageLayout>
  );
}
