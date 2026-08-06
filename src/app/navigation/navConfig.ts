import {
  Activity,
  Gauge,
  MessageSquare,
  Radio,
  Rss,
  Users,
  UserRound,
  Globe,
  PenSquare,
  type LucideIcon,
} from 'lucide-react';
import { APP_ROUTES } from '@/app/routes';

/** Badge sources the rail can read; keeps navConfig free of hook imports. */
export interface NavBadgeCounts {
  readonly unreadConversations: number;
  readonly activity: number;
}

export type NavBadgeKey = keyof NavBadgeCounts;

export interface DestinationDefinition {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly path: string;
  /** Extra path prefixes that should still light this destination up. */
  readonly matchPrefixes?: readonly string[];
  readonly badge?: NavBadgeKey;
}

export interface CreateActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** Primary destinations. Adding more is a product decision, not a drive-by edit. */
export const PRIMARY_DESTINATIONS: readonly DestinationDefinition[] = [
  {
    id: 'chats',
    label: 'Chats',
    icon: MessageSquare,
    path: APP_ROUTES.chat,
    matchPrefixes: ['/dms/', '/groups/'],
    badge: 'unreadConversations',
  },
  {
    id: 'feed',
    label: 'Feed',
    icon: Rss,
    path: APP_ROUTES.feed,
    matchPrefixes: [APP_ROUTES.feeds, '/channels/'],
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    path: APP_ROUTES.people,
    matchPrefixes: [APP_ROUTES.contacts, '/profile/'],
  },
  {
    id: 'manage',
    label: 'Manage',
    icon: Gauge,
    path: APP_ROUTES.manage,
    matchPrefixes: ['/manage/', APP_ROUTES.spaces],
  },
];

/** The `+` button's menu. Mode-independent and capped at four entries. */
export const CREATE_ACTIONS: readonly CreateActionDefinition[] = [
  { id: 'new-group', label: 'New group', icon: Users },
  { id: 'new-channel', label: 'New channel', icon: Radio },
  { id: 'new-space', label: 'New space', icon: Globe },
  { id: 'new-post', label: 'New post', icon: PenSquare },
];

/** Mode-independent, so it sits below the destinations rather than inside them. */
export const ACTIVITY_DESTINATION: DestinationDefinition = {
  id: 'activity',
  label: 'Activity',
  icon: Activity,
  path: APP_ROUTES.activity,
  matchPrefixes: [APP_ROUTES.notifications, '/pings'],
  badge: 'activity',
};

export const PROFILE_DESTINATION: DestinationDefinition = {
  id: 'me',
  label: 'My profile',
  icon: UserRound,
  path: APP_ROUTES.me,
};

const normalize = (path: string) => {
  const withoutQuery = path.split('?')[0];
  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
};

const matchesPrefix = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isDestinationActive = (
  destination: DestinationDefinition,
  pathname: string
): boolean => {
  const current = normalize(pathname);
  if (matchesPrefix(current, destination.path)) return true;
  return (destination.matchPrefixes ?? []).some((prefix) => matchesPrefix(current, prefix));
};

/** Resolves the active top-level destination from the current route. */
export const getDestinationForPath = (pathname: string): string | null => {
  const current = normalize(pathname);

  if (isDestinationActive(ACTIVITY_DESTINATION, current)) {
    return ACTIVITY_DESTINATION.id;
  }

  if (
    current.startsWith(APP_ROUTES.chat) ||
    matchesPrefix(current, '/dms') ||
    matchesPrefix(current, '/groups') ||
    (matchesPrefix(current, APP_ROUTES.spaces) &&
      ((current.includes('/groups/') && current.includes('/chat')) ||
        (current.includes('/channels/') && current.includes('/chat'))))
  ) {
    return 'chats';
  }

  if (current.includes('/manage')) {
    return 'manage';
  }

  const primary = PRIMARY_DESTINATIONS.find((destination) =>
    isDestinationActive(destination, current)
  );

  return primary?.id ?? null;
};
