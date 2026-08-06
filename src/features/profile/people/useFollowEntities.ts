import { useQueries } from '@tanstack/react-query';

import { channelsApi, usersApi } from '@/api/endpoints';
import type { Relationship } from '@/api/types';

export type FollowListMode = 'followers' | 'following';

export interface FollowListTarget {
  kind: 'user' | 'channel';
  id: string;
}

export interface FollowListEntity {
  kind: 'user' | 'channel';
  id: string;
  label: string;
  secondary: string | null;
  avatarUrl: string | null;
}

export function resolveFollowTarget(
  mode: FollowListMode,
  relationship: Relationship
): FollowListTarget | null {
  if (mode === 'followers') {
    return { kind: 'user', id: relationship.user_id };
  }
  if (relationship.target_type === 'user' || relationship.target_type === 'channel') {
    return { kind: relationship.target_type, id: relationship.target_id };
  }
  return null;
}

export async function loadFollowEntity(target: FollowListTarget): Promise<FollowListEntity> {
  if (target.kind === 'channel') {
    const channel = await channelsApi.get(target.id);
    return {
      kind: 'channel',
      id: channel.id,
      label: channel.name,
      secondary: `#${channel.slug}`,
      avatarUrl: channel.avatar?.url ?? null,
    };
  }

  const user = await usersApi.getUser(target.id);
  return {
    kind: 'user',
    id: user.id,
    label: user.display_name || user.username || user.id,
    secondary: user.username ? `@${user.username}` : null,
    avatarUrl: user.avatar?.url ?? null,
  };
}

/**
 * A follow relationship only stores ids, so each one needs a lookup to become a
 * displayable row. Shared by the profile dialog and the People page so the two
 * cannot drift.
 */
export function useFollowEntities(
  mode: FollowListMode,
  relationships: Relationship[],
  enabled = true
) {
  const targets = relationships
    .filter((relationship) => relationship.status === 'active')
    .map((relationship) => resolveFollowTarget(mode, relationship))
    .filter((target): target is FollowListTarget => target !== null);

  const queries = useQueries({
    queries: targets.map((target) => ({
      queryKey: ['follow-entity', target.kind, target.id],
      queryFn: () => loadFollowEntity(target),
      enabled,
    })),
  });

  return {
    targets,
    entities: queries.flatMap((query) => (query.data ? [query.data] : [])),
    isLoading: queries.some((query) => query.isLoading),
  };
}
