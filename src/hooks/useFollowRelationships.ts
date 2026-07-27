import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { followsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { Relationship } from '@/api/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import { useAuthStore } from '@/store/authStore';

export type FollowTargetType = 'user' | 'channel';

const followingKey = (userId: string | null) =>
  ['follow-relationships', 'following', userId] as const;

export const followersKey = (userId: string) =>
  ['follow-relationships', 'followers', userId] as const;

export function useFollowingRelationships(userId: string | null | undefined) {
  return useQuery({
    queryKey: followingKey(userId ?? null),
    queryFn: () => followsApi.listFollowing(userId as string),
    enabled: Boolean(userId),
  });
}

export function useFollowerRelationships(userId: string | null | undefined) {
  return useQuery({
    queryKey: followersKey(userId ?? ''),
    queryFn: () => followsApi.listFollowers(userId as string),
    enabled: Boolean(userId),
  });
}

export function useFollowTarget(targetType: FollowTargetType, targetId: string) {
  const currentUserId = useAuthStore((state) => state.userId);
  const { socket } = useSocketStore();
  const queryClient = useQueryClient();
  const followingQuery = useFollowingRelationships(currentUserId);
  const key = followingKey(currentUserId);

  useEffect(() => {
    if (!socket) return;

    const reconcile = () => {
      queryClient.invalidateQueries({ queryKey: ['follow-relationships'] });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    };

    socket.on(EVENTS.RELATIONSHIP_REQUESTED, reconcile);
    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, reconcile);
    socket.on(EVENTS.RELATIONSHIP_REVOKED, reconcile);

    return () => {
      socket.off(EVENTS.RELATIONSHIP_REQUESTED, reconcile);
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, reconcile);
      socket.off(EVENTS.RELATIONSHIP_REVOKED, reconcile);
    };
  }, [queryClient, socket]);

  const relationship =
    followingQuery.data?.find(
      (item) =>
        item.kind === 'follow' &&
        item.target_type === targetType &&
        item.target_id === targetId &&
        item.status !== 'revoked'
    ) ?? null;

  const followMutation = useMutation({
    mutationFn: () =>
      targetType === 'user'
        ? followsApi.followUser(targetId)
        : followsApi.followChannel(targetId),
    onMutate: async () => {
      if (!currentUserId) return undefined;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Relationship[]>(key);
      const now = new Date().toISOString();
      const optimistic: Relationship = {
        id: `optimistic:${targetType}:${targetId}`,
        kind: 'follow',
        user_id: currentUserId,
        target_type: targetType,
        target_id: targetId,
        status: 'pending',
        initiation: 'request',
        initiated_by: currentUserId,
        approved_by: null,
        pair_id: null,
        role_ids: [],
        state: {
          muted_until: null,
          archived: false,
          pinned: false,
          hidden: false,
          folder: null,
          last_read_message_id: null,
          notification_level: 'all',
        },
        requested_at: now,
        activated_at: null,
        ended_at: null,
        created_at: now,
        updated_at: now,
      };
      queryClient.setQueryData<Relationship[]>(key, [
        ...(previous?.filter(
          (item) =>
            item.target_type !== targetType || item.target_id !== targetId
        ) ?? []),
        optimistic,
      ]);
      return { previous };
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Relationship[]>(key, (current = []) => [
        ...current.filter(
          (item) =>
            item.target_type !== targetType || item.target_id !== targetId
        ),
        created,
      ]);
      toast.success(created.status === 'pending' ? 'Follow request sent' : 'Following');
    },
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      toast.error(extractApiError(error, 'Could not follow'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () =>
      targetType === 'user'
        ? followsApi.unfollowUser(targetId)
        : followsApi.unfollowChannel(targetId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Relationship[]>(key);
      queryClient.setQueryData<Relationship[]>(
        key,
        previous?.filter(
          (item) =>
            item.target_type !== targetType || item.target_id !== targetId
        ) ?? []
      );
      return { previous };
    },
    onSuccess: () => toast.success('Unfollowed'),
    onError: (error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(key, context.previous);
      }
      toast.error(extractApiError(error, 'Could not unfollow'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    },
  });

  return {
    relationship,
    isFollowing: relationship?.status === 'active',
    isPending: relationship?.status === 'pending',
    isLoading: followingQuery.isLoading,
    follow: followMutation.mutateAsync,
    unfollow: unfollowMutation.mutateAsync,
    isMutating: followMutation.isPending || unfollowMutation.isPending,
  };
}
