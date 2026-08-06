import { type ComponentType, type ReactNode, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Ban,
  Globe,
  Loader2,
  MessagesSquare,
  Radio,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { blocksApi, capabilitiesApi, directoryApi, spacesApi } from '@/api/endpoints';
import type {
  BlockedUserListItem,
  ChannelSummary,
  DiscoveredUser,
  GroupSummary,
  OmniResults,
  ResourceRef,
  SpaceChannelView,
  SpaceGroupView,
  SpaceSummary,
  SpaceView,
} from '@/api/types';
import { ROLE_ADMIN } from '@/api/types';
import { APP_ROUTES, ManageTab, isManageTab } from '@/app/routes';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { PageTabs } from '@/components/page/PageTabs';
import type { PageTab } from '@/components/page/pageTypes';
import { useContacts } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';

interface ManagedChannel extends SpaceChannelView {
  space_id: string;
  space_name: string;
}

interface ManagedGroup extends SpaceGroupView {
  space_id: string;
  space_name: string;
}

interface ManagedCatalog {
  spaces: SpaceView[];
  channels: ManagedChannel[];
  groups: ManagedGroup[];
}

interface ManageRowProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  avatarUrl?: string | null;
  onOpen: () => void;
  onManage?: () => void;
  manageLabel?: string;
  className?: string;
}

const tabs: readonly PageTab[] = [
  { id: 'people', label: 'People', icon: Users },
  { id: 'spaces', label: 'Spaces', icon: Globe },
  { id: 'channels', label: 'Channels', icon: Radio },
  { id: 'groups', label: 'Groups', icon: MessagesSquare },
];

function avatarUrl(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || !('url' in meta)) {
    return null;
  }

  const url = (meta as { url?: unknown }).url;
  return typeof url === 'string' ? url : null;
}

function itemInitial(title: string) {
  return (title.trim()[0] || '?').toUpperCase();
}

function canManageSpace(space: SpaceView, userId: string | null) {
  return space.owner_user_id === userId || space.viewer_role === ROLE_ADMIN;
}

async function loadManagedCatalog(userId: string | null): Promise<ManagedCatalog> {
  const spaces = await spacesApi.list();
  const managedSpaces = spaces.filter((space) => canManageSpace(space, userId));
  const childLists = await Promise.all(
    managedSpaces.map(async (space) => {
      const [channels, groups] = await Promise.all([
        spacesApi.listChannels(space.id),
        spacesApi.listGroups(space.id),
      ]);

      return {
        channels: channels.map((channel) => ({
          ...channel,
          space_id: space.id,
          space_name: space.name,
        })),
        groups: groups.map((group) => ({
          ...group,
          space_id: space.id,
          space_name: space.name,
        })),
      };
    })
  );

  return {
    spaces: managedSpaces,
    channels: childLists.flatMap((item) => item.channels),
    groups: childLists.flatMap((item) => item.groups),
  };
}

function resourceKey(resource: ResourceRef) {
  return `${resource.type}:${resource.id}`;
}

function resourceRefForSummary(item: SpaceSummary | ChannelSummary | GroupSummary): ResourceRef {
  if ('owner' in item) {
    return { type: 'channel', id: item.id };
  }

  if ('member_count' in item && 'space_id' in item) {
    return { type: 'conversation', id: item.id };
  }

  return { type: 'space', id: item.id };
}

function ManageRow({
  icon: Icon,
  title,
  subtitle,
  meta,
  avatarUrl: imageUrl,
  onOpen,
  onManage,
  manageLabel = 'Manage',
  className,
}: ManageRowProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-border/60 p-4 last:border-b-0 sm:flex-row sm:items-center',
        className
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <Avatar className="h-11 w-11 shrink-0 border border-border/60">
          {imageUrl ? <AvatarImage src={imageUrl} className="object-cover" /> : null}
          <AvatarFallback>
            {imageUrl ? <Icon className="h-4 w-4" /> : itemInitial(title)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
          {subtitle ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
          {meta ? <span className="mt-1 block text-xs text-muted-foreground">{meta}</span> : null}
        </span>
      </button>
      <div className="flex shrink-0 justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>
          Open
        </Button>
        {onManage ? (
          <Button type="button" size="sm" onClick={onManage}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            {manageLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export default function ManageHubPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const userId = useAuthStore((state) => state.userId);
  const [query, setQuery] = useState('');
  const activeTab: ManageTab = isManageTab(tab) ? tab : 'people';
  const trimmedQuery = query.trim();
  const searchEnabled = trimmedQuery.length >= 2;
  const { contacts, isLoadingContacts } = useContacts();

  const blocksQuery = useQuery({
    queryKey: ['blocks', 'manage'],
    queryFn: () => blocksApi.list(50),
    enabled: activeTab === 'people' && !searchEnabled,
  });

  const managedQuery = useQuery({
    queryKey: ['manage', 'catalog', userId],
    queryFn: () => loadManagedCatalog(userId),
    enabled: !!userId && !searchEnabled,
  });

  const omniQuery = useQuery({
    queryKey: ['manage', 'search', trimmedQuery],
    queryFn: () => directoryApi.omni(trimmedQuery),
    enabled: searchEnabled,
  });

  const searchResources = useMemo<ResourceRef[]>(() => {
    const data = omniQuery.data;
    if (!data) return [];

    return [...data.spaces, ...data.channels, ...data.groups].map(resourceRefForSummary);
  }, [omniQuery.data]);

  const capabilitiesQuery = useQuery({
    queryKey: ['manage', 'search-capabilities', searchResources],
    queryFn: () =>
      capabilitiesApi.resolve({
        resources: searchResources,
        actions: ['resource.manage'],
      }),
    enabled: searchEnabled && searchResources.length > 0,
  });

  const capabilityMap = useMemo(() => {
    const entries = capabilitiesQuery.data?.capabilities ?? [];
    return new Map(
      entries.map((capability) => [
        resourceKey(capability.resource),
        capability.allowed.includes('resource.manage') || capability.standing.is_owner,
      ])
    );
  }, [capabilitiesQuery.data]);

  const canManageSearchItem = (item: SpaceSummary | ChannelSummary | GroupSummary) => {
    const ref = resourceRefForSummary(item);
    return capabilityMap.get(resourceKey(ref)) === true;
  };

  const blockedUsers = blocksQuery.data?.data ?? [];
  const managed = managedQuery.data ?? { spaces: [], channels: [], groups: [] };
  const searchResults: OmniResults = omniQuery.data ?? {
    spaces: [],
    channels: [],
    groups: [],
    people: [],
  };

  const renderPeople = () => {
    if (searchEnabled) {
      if (omniQuery.isLoading) {
        return <LoadingState label="Searching people..." />;
      }

      return searchResults.people.length === 0 ? (
        <EmptyState label="No people found." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
          {searchResults.people.map((person) => renderPersonRow(person))}
        </div>
      );
    }

    if (isLoadingContacts || blocksQuery.isLoading) {
      return <LoadingState label="Loading people..." />;
    }

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
          {contacts.length === 0 ? (
            <EmptyState label="No contacts yet." />
          ) : (
            contacts.map((item) => renderPersonRow(item.peer))
          )}
        </div>
        {blockedUsers.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
            {blockedUsers.map((item) => renderBlockedRow(item))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderSpaces = () => {
    if (searchEnabled) {
      return renderSearchSection(
        omniQuery.isLoading,
        searchResults.spaces,
        (space) => (
          <ManageRow
            key={space.id}
            icon={Globe}
            title={space.name}
            subtitle={space.description || `/${space.slug}`}
            meta={`${space.visibility} · ${space.member_count} members`}
            avatarUrl={avatarUrl(space.avatar)}
            onOpen={() => navigate(APP_ROUTES.spaceDetail(space.id))}
            onManage={canManageSearchItem(space) ? () => navigate(APP_ROUTES.spaceManage(space.id)) : undefined}
          />
        ),
        'No spaces found.'
      );
    }

    return renderManagedSection(
      managedQuery.isLoading,
      managed.spaces,
      (space) => (
        <ManageRow
          key={space.id}
          icon={Globe}
          title={space.name}
          subtitle={`/${space.slug}`}
          meta={`${space.visibility} · ${space.viewer_role ?? 'Owner'}`}
          avatarUrl={avatarUrl(space.avatar)}
          onOpen={() => navigate(APP_ROUTES.spaceDetail(space.id))}
          onManage={() => navigate(APP_ROUTES.spaceManage(space.id))}
        />
      ),
      'No owned or admin spaces.'
    );
  };

  const renderChannels = () => {
    if (searchEnabled) {
      return renderSearchSection(
        omniQuery.isLoading,
        searchResults.channels,
        (channel) => (
          <ManageRow
            key={channel.id}
            icon={Radio}
            title={channel.name}
            subtitle={channel.description || (channel.space_id ? 'Space channel' : 'Personal channel')}
            meta={`${channel.visibility} · ${channel.follower_count} followers`}
            avatarUrl={avatarUrl(channel.avatar)}
            onOpen={() =>
              navigate(
                channel.space_id
                  ? APP_ROUTES.spaceChannel(channel.space_id, channel.id)
                  : APP_ROUTES.channel(channel.id)
              )
            }
            onManage={
              canManageSearchItem(channel)
                ? () =>
                    navigate(
                      channel.space_id
                        ? APP_ROUTES.spaceChannelManage(channel.space_id, channel.id)
                        : APP_ROUTES.channelManage(channel.id)
                    )
                : undefined
            }
          />
        ),
        'No channels found.'
      );
    }

    return renderManagedSection(
      managedQuery.isLoading,
      managed.channels,
      (channel) => (
        <ManageRow
          key={channel.id}
          icon={Radio}
          title={channel.name}
          subtitle={channel.description || channel.space_name}
          meta={`${channel.kind} · ${channel.visibility}`}
          onOpen={() => navigate(APP_ROUTES.spaceChannel(channel.space_id, channel.id))}
          onManage={() => navigate(APP_ROUTES.spaceChannelManage(channel.space_id, channel.id))}
        />
      ),
      'No managed channels.'
    );
  };

  const renderGroups = () => {
    if (searchEnabled) {
      return renderSearchSection(
        omniQuery.isLoading,
        searchResults.groups,
        (group) => (
          <ManageRow
            key={group.id}
            icon={MessagesSquare}
            title={group.title || 'Untitled group'}
            subtitle={group.description || 'Group conversation'}
            meta={`${group.member_count} members`}
            avatarUrl={avatarUrl(group.image)}
            onOpen={() => navigate(APP_ROUTES.spaceGroupChat(group.space_id, group.id))}
            onManage={
              canManageSearchItem(group)
                ? () => navigate(APP_ROUTES.spaceGroupManage(group.space_id, group.id))
                : undefined
            }
          />
        ),
        'No groups found.'
      );
    }

    return renderManagedSection(
      managedQuery.isLoading,
      managed.groups,
      (group) => (
        <ManageRow
          key={group.id}
          icon={MessagesSquare}
          title={group.title || 'Untitled group'}
          subtitle={group.space_name}
          meta={`${group.participant_count} participants`}
          onOpen={() => navigate(APP_ROUTES.spaceGroupChat(group.space_id, group.id))}
          onManage={() => navigate(APP_ROUTES.spaceGroupManage(group.space_id, group.id))}
        />
      ),
      'No managed groups.'
    );
  };

  function renderPersonRow(person: DiscoveredUser | BlockedUserListItem['user']) {
    const title = person.display_name || person.username || person.id;
    return (
      <ManageRow
        key={person.id}
        icon={UserRound}
        title={title}
        subtitle={person.username ? `@${person.username}` : null}
        meta={'connection_status' in person && person.connection_status ? person.connection_status : null}
        avatarUrl={avatarUrl(person.avatar)}
        onOpen={() => navigate(APP_ROUTES.profile(person.id))}
        manageLabel="Profile"
        onManage={() => navigate(APP_ROUTES.people)}
      />
    );
  }

  function renderBlockedRow(item: BlockedUserListItem) {
    const title = item.user.display_name || item.user.username || item.user.id;
    return (
      <ManageRow
        key={item.user.id}
        icon={Ban}
        title={title}
        subtitle={item.user.username ? `@${item.user.username}` : null}
        meta="Blocked"
        avatarUrl={avatarUrl(item.user.avatar)}
        onOpen={() => navigate(APP_ROUTES.profile(item.user.id))}
        manageLabel="People"
        onManage={() => navigate(APP_ROUTES.peopleTab('blocked'))}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title="Manage"
        description="People, spaces, channels and groups"
        tabs={
          <PageTabs
            tabs={tabs}
            activeTabId={activeTab}
            onSelect={(tabId) => navigate(APP_ROUTES.manageTab(tabId as ManageTab))}
            aria-label="Manage sections"
          />
        }
        primaryAction={{
          id: 'spaces',
          label: 'New space',
          icon: Globe,
          onSelect: () => navigate(APP_ROUTES.spaces),
        }}
      />

      <PageBody className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people, spaces, channels and groups"
            className="pl-9"
          />
        </div>

        <PanelSection
          title={tabs.find((item) => item.id === activeTab)?.label}
          description={searchEnabled ? `Search results for "${trimmedQuery}"` : 'Owned and admin-managed items'}
          bodyClassName="p-0 sm:p-0"
        >
          {activeTab === 'people' ? renderPeople() : null}
          {activeTab === 'spaces' ? renderSpaces() : null}
          {activeTab === 'channels' ? renderChannels() : null}
          {activeTab === 'groups' ? renderGroups() : null}
        </PanelSection>
      </PageBody>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function renderManagedSection<T>(
  isLoading: boolean,
  items: readonly T[],
  renderItem: (item: T) => ReactNode,
  emptyLabel: string
) {
  if (isLoading) {
    return <LoadingState label="Loading managed items..." />;
  }

  return items.length === 0 ? (
    <EmptyState label={emptyLabel} />
  ) : (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
      {items.map(renderItem)}
    </div>
  );
}

function renderSearchSection<T>(
  isLoading: boolean,
  items: readonly T[],
  renderItem: (item: T) => ReactNode,
  emptyLabel: string
) {
  if (isLoading) {
    return <LoadingState label="Searching..." />;
  }

  return items.length === 0 ? (
    <EmptyState label={emptyLabel} />
  ) : (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/60">
      {items.map(renderItem)}
    </div>
  );
}
