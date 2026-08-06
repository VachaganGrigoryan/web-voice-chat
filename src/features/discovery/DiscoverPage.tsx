import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock3,
  Compass,
  Globe,
  Loader2,
  Lock,
  MessagesSquare,
  Radio,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { directoryApi } from '@/api/endpoints';
import { directoryKeys } from '@/api/queryKeys';
import type { ChannelSummary, SpaceSummary } from '@/api/types';
import { APP_ROUTES, DiscoverTab, isDiscoverTab } from '@/app/routes';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { PageTabs } from '@/components/page/PageTabs';
import { PageTab } from '@/components/page/pageTypes';
import { PresenceDot, resolvePresenceState } from '@/components/presence/PresenceDot';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';
import { useFollowTarget } from '@/hooks/useFollowRelationships';
import { useSpaces } from '@/hooks/useSpaces';
import { useAuthStore } from '@/store/authStore';

const PEOPLE_SEARCH_MIN_LENGTH = 2;
const PAGE_SIZE = 20;

interface DiscoverRowProps {
  title: string;
  subtitle?: string | null;
  onSelect: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function DiscoverRow({ title, subtitle, onSelect, actions, children }: DiscoverRowProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/60 bg-background/75 p-3 text-left shadow-e1 transition-colors hover:border-border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}

function SpaceJoinAction({ space }: { space: SpaceSummary }) {
  const queryClient = useQueryClient();
  const { joinSpace, isJoiningSpace } = useSpaces();

  if (space.is_default || space.viewer.membership_status) {
    return null;
  }

  if (space.join_policy === 'invite_only' || space.join_policy === 'closed') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Invite only
      </span>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isJoiningSpace}
      onClick={() => {
        void joinSpace(space.id).then(() => {
          void queryClient.invalidateQueries({ queryKey: directoryKeys.all });
        });
      }}
    >
      {isJoiningSpace ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
      {space.join_policy === 'approval' ? 'Request to join' : 'Join'}
    </Button>
  );
}

function ChannelFollowAction({ channel }: { channel: ChannelSummary }) {
  const currentUserId = useAuthStore((state) => state.userId);
  const { isFollowing, isPending, isMutating, follow, unfollow } = useFollowTarget(
    'channel',
    channel.id
  );

  if (channel.owner.type === 'user' && channel.owner.id === currentUserId) {
    return null;
  }

  if (isPending) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        <Clock3 className="mr-1.5 h-3.5 w-3.5" />
        Pending
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={isMutating}
      onClick={() => void (isFollowing ? unfollow() : follow())}
    >
      {isMutating ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
      ) : (
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      )}
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function LoadMoreButton({ onClick, isLoading }: { onClick: () => void; isLoading: boolean }) {
  return (
    <div className="flex justify-center pt-2">
      <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={onClick}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Load more
      </Button>
    </div>
  );
}

/**
 * Cross-entity jumping-off point: find people, spaces, channels and groups the
 * viewer does not already belong to. Every tab queries the directory API —
 * nothing here filters the viewer's own memberships client-side.
 */
export default function DiscoverPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const activeTab: DiscoverTab = isDiscoverTab(tab) ? tab : 'people';

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 400);
  const effectiveQuery = debouncedQuery || undefined;

  const peopleQuery = useQuery({
    queryKey: directoryKeys.list('people', { q: debouncedQuery }),
    queryFn: () => directoryApi.listPeople({ q: debouncedQuery, limit: PAGE_SIZE }),
    enabled: activeTab === 'people' && debouncedQuery.length >= PEOPLE_SEARCH_MIN_LENGTH,
  });
  const people = peopleQuery.data?.data ?? [];

  const channelsQuery = useInfiniteQuery({
    queryKey: directoryKeys.list('channels', { q: effectiveQuery }),
    queryFn: ({ pageParam }) =>
      directoryApi.listChannels({ q: effectiveQuery, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: activeTab === 'channels',
  });
  const channels = channelsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const spacesQuery = useInfiniteQuery({
    queryKey: directoryKeys.list('spaces', { q: effectiveQuery }),
    queryFn: ({ pageParam }) =>
      directoryApi.listSpaces({ q: effectiveQuery, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: activeTab === 'spaces',
  });
  const spaces = spacesQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const groupsQuery = useInfiniteQuery({
    queryKey: directoryKeys.list('groups', { q: effectiveQuery }),
    queryFn: ({ pageParam }) =>
      directoryApi.listGroups({ q: effectiveQuery, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: activeTab === 'groups',
  });
  const groups = groupsQuery.data?.pages.flatMap((page) => page.data) ?? [];

  const tabs: readonly PageTab[] = [
    { id: 'people', label: 'People', icon: Users },
    { id: 'channels', label: 'Channels', icon: Radio },
    { id: 'spaces', label: 'Spaces', icon: Globe },
    { id: 'groups', label: 'Groups', icon: MessagesSquare },
  ];

  const searchPlaceholder =
    activeTab === 'people' ? 'Search by name or username' : `Search ${activeTab}`;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title="Discover"
        description="Find people, spaces, channels and groups you don't already belong to"
        tabs={
          <PageTabs
            tabs={tabs}
            activeTabId={activeTab}
            onSelect={(tabId) => navigate(APP_ROUTES.discoverTab(tabId as DiscoverTab))}
            aria-label="Discover sections"
          />
        }
        primaryAction={{
          id: 'requests',
          label: 'Requests',
          icon: Compass,
          onSelect: () => navigate(APP_ROUTES.activityTab('requests')),
        }}
      />

      <PageBody>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label className="sr-only" htmlFor="discover-search">
            {searchPlaceholder}
          </label>
          <Input
            id="discover-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        {activeTab === 'people' ? (
          <div className="space-y-2">
            {debouncedQuery.length < PEOPLE_SEARCH_MIN_LENGTH ? (
              <EmptyState
                message={`Type at least ${PEOPLE_SEARCH_MIN_LENGTH} characters to search.`}
              />
            ) : peopleQuery.isLoading ? (
              <EmptyState message="Searching..." />
            ) : peopleQuery.isError ? (
              <EmptyState message="Failed to search people." />
            ) : people.length === 0 ? (
              <EmptyState message="No people matched that search." />
            ) : (
              people.map((user) => (
                <DiscoverRow
                  key={user.id}
                  title={user.display_name || user.username || 'Unknown'}
                  subtitle={user.username ? `@${user.username}` : null}
                  onSelect={() => navigate(APP_ROUTES.profile(user.id))}
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10 border border-border/60">
                      {user.avatar?.url ? <AvatarImage src={user.avatar.url} /> : null}
                      <AvatarFallback>
                        {(user.display_name || user.username || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <PresenceDot state={resolvePresenceState(user)} anchored />
                  </div>
                </DiscoverRow>
              ))
            )}
          </div>
        ) : null}

        {activeTab === 'channels' ? (
          <div className="space-y-2">
            {channelsQuery.isLoading ? (
              <EmptyState message="Loading channels..." />
            ) : channelsQuery.isError ? (
              <EmptyState message="Failed to load channels." />
            ) : channels.length === 0 ? (
              <EmptyState
                message={effectiveQuery ? 'No channels matched that search.' : 'No channels to show yet.'}
              />
            ) : (
              <>
                {channels.map((channel) => (
                  <DiscoverRow
                    key={channel.id}
                    title={`# ${channel.name}`}
                    subtitle={`${channel.follower_count} follower${channel.follower_count === 1 ? '' : 's'}${channel.description ? ` · ${channel.description}` : ''}`}
                    onSelect={() => navigate(APP_ROUTES.channel(channel.id))}
                    actions={<ChannelFollowAction channel={channel} />}
                  >
                    <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-border/60">
                      {channel.avatar?.url ? <AvatarImage src={channel.avatar.url} /> : null}
                      <AvatarFallback className="rounded-xl bg-muted text-muted-foreground">
                        <Radio className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </DiscoverRow>
                ))}
                {channelsQuery.hasNextPage ? (
                  <LoadMoreButton
                    onClick={() => void channelsQuery.fetchNextPage()}
                    isLoading={channelsQuery.isFetchingNextPage}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'spaces' ? (
          <div className="space-y-2">
            {spacesQuery.isLoading ? (
              <EmptyState message="Loading spaces..." />
            ) : spacesQuery.isError ? (
              <EmptyState message="Failed to load spaces." />
            ) : spaces.length === 0 ? (
              <EmptyState
                message={effectiveQuery ? 'No spaces matched that search.' : 'No spaces to show yet.'}
              />
            ) : (
              <>
                {spaces.map((space) => (
                  <DiscoverRow
                    key={space.id}
                    title={space.name}
                    subtitle={`/${space.slug} · ${space.member_count} member${space.member_count === 1 ? '' : 's'}${space.is_default ? ' · Default space' : ''}`}
                    onSelect={() => navigate(APP_ROUTES.spaceDetail(space.id))}
                    actions={<SpaceJoinAction space={space} />}
                  >
                    <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-border/60">
                      {space.avatar?.url ? <AvatarImage src={space.avatar.url} /> : null}
                      <AvatarFallback className="rounded-xl bg-brand-muted text-brand">
                        <Globe className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </DiscoverRow>
                ))}
                {spacesQuery.hasNextPage ? (
                  <LoadMoreButton
                    onClick={() => void spacesQuery.fetchNextPage()}
                    isLoading={spacesQuery.isFetchingNextPage}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === 'groups' ? (
          <div className="space-y-2">
            {groupsQuery.isLoading ? (
              <EmptyState message="Loading groups..." />
            ) : groupsQuery.isError ? (
              <EmptyState message="Failed to load groups." />
            ) : groups.length === 0 ? (
              <EmptyState
                message={effectiveQuery ? 'No groups matched that search.' : 'No groups to show yet.'}
              />
            ) : (
              <>
                {groups.map((group) => {
                  const joined = Boolean(group.viewer.membership_status);
                  return (
                    <DiscoverRow
                      key={group.id}
                      title={group.title || 'Untitled group'}
                      subtitle={`${group.member_count} member${group.member_count === 1 ? '' : 's'}`}
                      onSelect={() =>
                        navigate(
                          joined
                            ? APP_ROUTES.spaceGroupChat(group.space_id, group.id)
                            : APP_ROUTES.spaceDetailTab(group.space_id, 'groups')
                        )
                      }
                    >
                      <Avatar className="h-10 w-10 shrink-0 rounded-xl border border-border/60">
                        {group.image?.url ? <AvatarImage src={group.image.url} /> : null}
                        <AvatarFallback className="rounded-xl bg-muted text-muted-foreground">
                          <MessagesSquare className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    </DiscoverRow>
                  );
                })}
                {groupsQuery.hasNextPage ? (
                  <LoadMoreButton
                    onClick={() => void groupsQuery.fetchNextPage()}
                    isLoading={groupsQuery.isFetchingNextPage}
                  />
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </PageBody>
    </div>
  );
}
