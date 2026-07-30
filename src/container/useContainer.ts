import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { channelsApi, conversationsApi } from '@/api/endpoints';
import { channelKeys, inboxKeys } from '@/api/queryKeys';
import type { Channel, Conversation, MessageContainerRef } from '@/api/types';
import { fromPermissionStrings, fromPolicy } from './capabilities';
import { endpointsFor } from './endpointsFor';
import type { ViewerStanding } from './policy';
import { defaultLensFor, resolveContainer } from './resolveContainer';
import type {
  ContainerDescriptor,
  ContainerLens,
  ContainerSource,
  ConversationOnlyAffordances,
} from './types';
import { useContainerCapabilities } from './useCapabilities';

/**
 * Resolves a container reference into a fully-formed descriptor.
 *
 * The `descriptor | null` return is deliberate and is what removes the non-null
 * assertions the old chat hook needed: a caller guards once at the top instead
 * of asserting at every use.
 */

export interface UseContainerOptions {
  /** Chosen by the route. Defaults per container type when omitted. */
  readonly lens?: ContainerLens;
  /** Provided by the caller for conversations; ignored for channels. */
  readonly conversationOnly?: ConversationOnlyAffordances | null;
  /** A source the caller already has, to avoid a redundant fetch. */
  readonly source?: ContainerSource | null;
}

export interface UseContainerResult {
  readonly descriptor: ContainerDescriptor | null;
  readonly isLoading: boolean;
  readonly isMissing: boolean;
}

const standingFrom = (
  source: ContainerSource,
  currentUserId: string | null
): ViewerStanding => {
  if (source.kind === 'conversation') {
    const { conversation } = source;
    const isOwner =
      conversation.owner_type === 'user' &&
      !!currentUserId &&
      conversation.owner_id === currentUserId;
    const isMember =
      !!currentUserId && (conversation.participant_ids ?? []).includes(currentUserId);
    return {
      isOwner,
      // A DM has no admin tier; either participant manages its own pins.
      isModerator: isOwner || conversation.type === 'dm',
      isActiveMember: isMember || isOwner,
      isFollower: false,
    };
  }

  const { channel } = source;
  const isOwner =
    channel.owner.type === 'user' && !!currentUserId && channel.owner.id === currentUserId;
  const viewer = channel.viewer ?? null;
  return {
    isOwner: isOwner || !!viewer?.can_manage,
    isModerator: isOwner || !!viewer?.can_manage,
    isActiveMember: viewer?.membership_status === 'active',
    isFollower: !!viewer?.is_follower,
  };
};

export function useContainer(
  ref: MessageContainerRef | null,
  currentUserId: string | null,
  options: UseContainerOptions = {}
): UseContainerResult {
  const { lens, conversationOnly = null, source: providedSource = null } = options;

  const needsFetch = !!ref && !providedSource;

  const channelQuery = useQuery<Channel>({
    queryKey: ref ? channelKeys.detail(ref.container_id) : channelKeys.all,
    queryFn: () => channelsApi.get(ref!.container_id),
    enabled: needsFetch && ref?.container_type === 'channel',
  });

  const conversationQuery = useQuery<Conversation>({
    queryKey: ref ? inboxKeys.conversation(ref.container_id) : inboxKeys.conversations,
    queryFn: () => conversationsApi.getConversation(ref!.container_id),
    enabled: needsFetch && ref?.container_type === 'conversation',
  });

  const source: ContainerSource | null = useMemo(() => {
    if (providedSource) return providedSource;
    if (!ref) return null;
    if (ref.container_type === 'channel') {
      return channelQuery.data
        ? { kind: 'channel', channel: channelQuery.data, state: null }
        : null;
    }
    return conversationQuery.data
      ? { kind: 'conversation', conversation: conversationQuery.data }
      : null;
  }, [providedSource, ref, channelQuery.data, conversationQuery.data]);

  const { capabilities: serverCapabilities } = useContainerCapabilities(ref);

  const descriptor = useMemo(() => {
    if (!source) return null;

    // The provisional answer paints immediately; the server's replaces it
    // wholesale rather than being blended, so there is never a half-and-half
    // capability set.
    const capabilities = serverCapabilities
      ? fromPermissionStrings(source, serverCapabilities)
      : fromPolicy(source, standingFrom(source, currentUserId));

    return resolveContainer({
      source,
      capabilities,
      endpoints: endpointsFor(source),
      lens: lens ?? defaultLensFor(source),
      conversationOnly,
    });
  }, [source, serverCapabilities, currentUserId, lens, conversationOnly]);

  const activeQuery =
    ref?.container_type === 'channel' ? channelQuery : conversationQuery;

  return {
    descriptor,
    isLoading: needsFetch && activeQuery.isLoading,
    isMissing: needsFetch && activeQuery.isError,
  };
}
