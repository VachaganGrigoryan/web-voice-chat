import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Compass,
  Hash,
  Globe,
  MessageSquare,
  Search,
  Settings,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

import { directoryApi, spacesApi } from '@/api/endpoints';
import { directoryKeys } from '@/api/queryKeys';
import { Conversation, SpaceView } from '@/api/types';
import { APP_ROUTES, DiscoverTab } from '@/app/routes';
import {
  ACTIVITY_DESTINATION,
  PRIMARY_DESTINATIONS,
  PROFILE_DESTINATION,
} from '@/app/navigation/navConfig';
import { useActiveSpace } from '@/app/shell/useActiveSpace';
import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { useConversations } from '@/hooks/useConversationList';
import { useDebounce } from '@/hooks/useDebounce';
import { SETTINGS_NAV_ITEMS } from '@/features/settings/config';
import { cn } from '@/lib/utils';

const OMNI_SEARCH_MIN_LENGTH = 2;

interface CommandEntry {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: LucideIcon;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useCommandEntries(onNavigate: (path: string) => void): CommandEntry[] {
  const activeSpaceId = useActiveSpace((state) => state.activeSpaceId);
  const { data: conversationPages } = useConversations(activeSpaceId);

  const { data: spaces = [] } = useQuery<SpaceView[]>({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });

  const { data: channels = [] } = useQuery({
    queryKey: ['spaces', activeSpaceId, 'channels'],
    queryFn: () => spacesApi.listChannels(activeSpaceId!),
    enabled: !!activeSpaceId,
  });

  return useMemo(() => {
    const conversations: Conversation[] =
      conversationPages?.pages.flatMap((page) => page.data || []).filter(Boolean) ?? [];

    const destinationEntries = PRIMARY_DESTINATIONS.map((destination) => ({
        id: `go:${destination.id}`,
        label: destination.label,
        hint: 'Destination',
        group: 'Go to',
        icon: destination.icon,
        run: () => onNavigate(destination.path),
      }));

    return [
      ...destinationEntries,
      {
        id: `go:${ACTIVITY_DESTINATION.id}`,
        label: ACTIVITY_DESTINATION.label,
        group: 'Go to',
        icon: ACTIVITY_DESTINATION.icon,
        run: () => onNavigate(ACTIVITY_DESTINATION.path),
      },
      {
        id: `go:${PROFILE_DESTINATION.id}`,
        label: PROFILE_DESTINATION.label,
        group: 'Go to',
        icon: PROFILE_DESTINATION.icon,
        run: () => onNavigate(PROFILE_DESTINATION.path),
      },
      ...conversations.map((conversation) => ({
        id: `conversation:${conversation.id}`,
        label:
          conversation.type === 'group'
            ? conversation.title || 'Group chat'
            : conversation.peer_user?.display_name ||
              conversation.peer_user?.username ||
              'Conversation',
        hint: conversation.type === 'group' ? 'Group' : 'Direct message',
        group: 'Conversations',
        icon: conversation.type === 'group' ? MessageSquare : UserRound,
        run: () => onNavigate(APP_ROUTES.chatConversation(conversation.id)),
      })),
      ...channels.map((channel) => ({
        id: `channel:${channel.id}`,
        label: channel.name,
        hint: 'Channel',
        group: 'Channels',
        icon: Hash,
        run: () => onNavigate(APP_ROUTES.channel(channel.id)),
      })),
      ...spaces.map((space) => ({
        id: `space:${space.id}`,
        label: space.name,
        hint: `/${space.slug}`,
        group: 'Spaces',
        icon: Globe,
        run: () => onNavigate(APP_ROUTES.spaceDetailTab(space.id)),
      })),
      ...SETTINGS_NAV_ITEMS.map((item) => ({
        id: `settings:${item.id}`,
        label: item.label,
        hint: 'Settings',
        group: 'Settings',
        icon: Settings,
        run: () => onNavigate(APP_ROUTES.settingsTab(item.id)),
      })),
    ];
  }, [conversationPages, channels, spaces, onNavigate]);
}

/**
 * A bounded, unpaginated preview across every directory type. The "see all"
 * entry per type is what carries the user into the real, paginated Discover
 * tab when the preview isn't enough.
 */
function useOmniEntries(
  query: string,
  onNavigate: (path: string) => void
): CommandEntry[] {
  const enabled = query.length >= OMNI_SEARCH_MIN_LENGTH;
  const omniQuery = useQuery({
    queryKey: directoryKeys.omni(query),
    queryFn: () => directoryApi.omni(query),
    enabled,
  });

  return useMemo(() => {
    if (!enabled || !omniQuery.data) return [];

    const seeAll = (tab: DiscoverTab, group: string): CommandEntry => ({
      id: `omni-see-all:${tab}`,
      label: `See all ${group.toLowerCase()} for "${query}"`,
      group,
      icon: Compass,
      run: () => onNavigate(APP_ROUTES.discoverTab(tab)),
    });

    return [
      ...omniQuery.data.people.map((user) => ({
        id: `omni-person:${user.id}`,
        label: user.display_name || user.username || 'Unknown',
        hint: user.username ? `@${user.username}` : 'Person',
        group: 'People',
        icon: UserRound,
        run: () => onNavigate(APP_ROUTES.profile(user.id)),
      })),
      seeAll('people', 'People'),
      ...omniQuery.data.channels.map((channel) => ({
        id: `omni-channel:${channel.id}`,
        label: channel.name,
        hint: 'Channel',
        group: 'Channels',
        icon: Hash,
        run: () => onNavigate(APP_ROUTES.channel(channel.id)),
      })),
      seeAll('channels', 'Channels'),
      ...omniQuery.data.spaces.map((space) => ({
        id: `omni-space:${space.id}`,
        label: space.name,
        hint: `/${space.slug}`,
        group: 'Spaces',
        icon: Globe,
        run: () => onNavigate(APP_ROUTES.spaceDetail(space.id)),
      })),
      seeAll('spaces', 'Spaces'),
      ...omniQuery.data.groups.map((group) => ({
        id: `omni-group:${group.id}`,
        label: group.title || 'Untitled group',
        hint: 'Group',
        group: 'Groups',
        icon: MessageSquare,
        run: () =>
          onNavigate(
            group.viewer.membership_status
              ? APP_ROUTES.spaceGroupChat(group.space_id, group.id)
              : APP_ROUTES.spaceDetailTab(group.space_id, 'groups')
          ),
      })),
      seeAll('groups', 'Groups'),
    ];
  }, [enabled, omniQuery.data, query, onNavigate]);
}

/**
 * Cross-entity quick switcher. With primary navigation deliberately kept small,
 * this is how everything else stays one keystroke away instead of being buried.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  const handleNavigate = useMemo(
    () => (path: string) => {
      onOpenChange(false);
      navigate(path);
    },
    [navigate, onOpenChange]
  );

  const entries = useCommandEntries(handleNavigate);
  const omniEntries = useOmniEntries(debouncedQuery, handleNavigate);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const localMatches = needle
      ? entries.filter(
          (entry) =>
            entry.label.toLowerCase().includes(needle) ||
            entry.hint?.toLowerCase().includes(needle)
        )
      : entries;
    const combined =
      debouncedQuery.length >= OMNI_SEARCH_MIN_LENGTH
        ? [...localMatches, ...omniEntries]
        : localMatches;
    return combined.slice(0, 40);
  }, [entries, query, omniEntries, debouncedQuery]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keep the highlighted row inside the scroll viewport during keyboard travel.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) =>
        results.length ? (current - 1 + results.length) % results.length : 0
      );
    } else if (event.key === 'Enter') {
      event.preventDefault();
      results[activeIndex]?.run();
    }
  };

  let lastGroup: string | null = null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" aria-label="Command palette">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a conversation, or search people, channels, spaces and groups"
            aria-label="Search commands"
            className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div ref={listRef} role="listbox" className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((entry, index) => {
              const Icon = entry.icon;
              const showGroup = entry.group !== lastGroup;
              lastGroup = entry.group;

              return (
                <div key={entry.id}>
                  {showGroup ? (
                    <div className="px-3 pb-1 pt-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {entry.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    data-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={entry.run}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors',
                      index === activeIndex
                        ? 'bg-brand text-brand-foreground'
                        : 'text-foreground/80 hover:bg-muted/60'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    {entry.hint ? (
                      <span
                        className={cn(
                          'shrink-0 text-2xs',
                          index === activeIndex
                            ? 'text-brand-foreground/70'
                            : 'text-muted-foreground'
                        )}
                      >
                        {entry.hint}
                      </span>
                    ) : null}
                    {index === activeIndex ? (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
