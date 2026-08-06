import { APP_ROUTES } from '@/app/routes';
import type { MessageContainerRef } from '@/api/types';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';
import type {
  ContainerCapabilities,
  ContainerDescriptor,
  ContainerEndpoints,
  ContainerEnvelope,
  ContainerIdentity,
  ContainerLens,
  ContainerPolicyEcho,
  ContainerPresentation,
  ContainerRealtime,
  ContainerSource,
  ConversationOnlyAffordances,
} from './types';

/**
 * Pure. Everything asynchronous — fetching the source, fetching capabilities,
 * binding the transport closures — happens in `useContainer`; this module only
 * assembles, so its behaviour is fully testable without React or a network.
 */

export const refOf = (source: ContainerSource): MessageContainerRef =>
  source.kind === 'conversation'
    ? { container_type: 'conversation', container_id: source.conversation.id }
    : { container_type: 'channel', container_id: source.channel.id };

// --- identity ---------------------------------------------------------------

const conversationTitle = (source: Extract<ContainerSource, { kind: 'conversation' }>) => {
  const { conversation } = source;
  if (conversation.title) return conversation.title;

  const peer = conversation.peer_user;
  if (peer) return peer.display_name || peer.username || peer.id;
  return 'Conversation';
};

const conversationSubtitle = (
  source: Extract<ContainerSource, { kind: 'conversation' }>
) => {
  const { conversation } = source;
  if (conversation.type === 'dm') return null;
  const count = conversation.member_count;
  return `${count} ${count === 1 ? 'member' : 'members'}`;
};

const channelSubtitle = (source: Extract<ContainerSource, { kind: 'channel' }>) => {
  const count = source.channel.follower_count;
  return `${count} ${count === 1 ? 'follower' : 'followers'}`;
};

const buildIdentity = (
  source: ContainerSource,
  capabilities: ContainerCapabilities
): ContainerIdentity => {
  if (source.kind === 'conversation') {
    const { conversation } = source;
    const chat = APP_ROUTES.chatConversation(conversation.id);

    return {
      title: conversationTitle(source),
      subtitle: conversationSubtitle(source),
      avatar: conversation.image ?? null,
      badge: conversation.type === 'dm' ? 'dm' : 'group',
      ownerRef:
        conversation.owner_type && conversation.owner_id
          ? { type: conversation.owner_type, id: conversation.owner_id }
          : null,
      spaceId: conversation.space_id,
      routes: {
        chat,
        // A conversation has no social surface; only channels are feed sources.
        social: null,
        manage: capabilities.canManage ? `${chat}/manage/general` : null,
        thread: (rootMessageId) =>
          APP_ROUTES.chatConversationThread(conversation.id, rootMessageId),
      },
    };
  }

  const { channel } = source;
  return {
    title: channel.name,
    subtitle: channelSubtitle(source),
    avatar: channel.avatar,
    badge: channel.kind === 'profile' ? 'profile-channel' : 'channel',
    ownerRef: { type: channel.owner.type, id: channel.owner.id },
    spaceId: channel.space_id,
    routes: {
      chat: APP_ROUTES.chatChannel(channel.id),
      social: APP_ROUTES.channel(channel.id),
      manage: capabilities.canManage
        ? `${APP_ROUTES.channel(channel.id)}/manage/general`
        : null,
      thread: (rootMessageId) =>
        APP_ROUTES.chatChannelThread(channel.id, rootMessageId),
    },
  };
};

// --- presentation -----------------------------------------------------------

/**
 * The only part of the descriptor that reads the lens. Capabilities must not,
 * and `resolveContainer.test.ts` asserts they do not.
 */
const buildPresentation = (
  source: ContainerSource,
  lens: ContainerLens,
  capabilities: ContainerCapabilities
): ContainerPresentation => {
  const emptyState = !capabilities.canRead
    ? ('locked' as const)
    : lens === 'feed'
      ? ('no-posts' as const)
      : ('no-messages' as const);

  if (lens === 'feed') {
    return {
      lens,
      rootItem: 'post-card',
      replyItem: 'comment-row',
      order: 'newest-first',
      threadDisplay: 'inline-expand',
      composer: capabilities.canPost ? 'post-box' : 'none',
      groupConsecutive: false,
      showReadReceipts: false,
      showTypingIndicator: false,
      emptyState,
    };
  }

  return {
    lens,
    rootItem: 'message-row',
    replyItem: 'message-row',
    order: 'newest-at-bottom',
    threadDisplay: 'side-panel',
    composer: capabilities.canPost ? 'inline-bar' : 'none',
    groupConsecutive: true,
    // Receipts and typing are conversation-shaped; a channel has neither.
    showReadReceipts: source.kind === 'conversation',
    showTypingIndicator: source.kind === 'conversation',
    emptyState,
  };
};

// --- realtime ---------------------------------------------------------------

const buildRealtime = (source: ContainerSource): ContainerRealtime => {
  const ref = refOf(source);
  const isConversation = source.kind === 'conversation';

  /**
   * Tolerates the deprecated `conversation_id` mirror. Dropping it client-first
   * would make in-flight events stop matching during a deploy, so messages
   * would appear to vanish rather than error.
   */
  const matches = (event: ContainerEnvelope) => {
    const id = event.container_id ?? event.conversation_id ?? null;
    if (id !== ref.container_id) return false;
    if (!event.container_type) return isConversation;
    return event.container_type === ref.container_type;
  };

  return {
    matchesMessage: matches,
    matchesStatus: matches,
    matchesTyping: (event) => (isConversation ? matches(event) : false),
    matchesRead: (event) => (isConversation ? matches(event) : false),
    matchesPins: (event) => (isConversation ? matches(event) : false),
    // Channels broadcast to a per-container Socket.IO room now, so delivery
    // no longer depends on audience size the way a per-user fan-out loop did.
    reliability: 'live',
  };
};

// --- policy echo ------------------------------------------------------------

const buildPolicyEcho = (source: ContainerSource): ContainerPolicyEcho =>
  source.kind === 'conversation'
    ? {
        kind: 'conversation',
        postingPolicy: source.conversation.posting_policy,
        visibility: source.conversation.visibility,
      }
    : {
        kind: 'channel',
        postingPolicy: source.channel.posting_policy,
        commentPolicy: source.channel.comment_policy,
        visibility: source.channel.visibility,
        joinPolicy: source.channel.join_policy,
      };

// --- assembly ---------------------------------------------------------------

export interface ResolveContainerInput {
  readonly source: ContainerSource;
  readonly capabilities: ContainerCapabilities;
  readonly endpoints: ContainerEndpoints;
  /** Defaults to the lens each container type is most often read through. */
  readonly lens?: ContainerLens;
  readonly conversationOnly?: ConversationOnlyAffordances | null;
}

export const defaultLensFor = (source: ContainerSource): ContainerLens =>
  source.kind === 'conversation' ? 'timeline' : 'feed';

export const resolveContainer = ({
  source,
  capabilities,
  endpoints,
  lens,
  conversationOnly = null,
}: ResolveContainerInput): ContainerDescriptor => {
  const activeLens = lens ?? defaultLensFor(source);

  return {
    ref: refOf(source),
    source,
    identity: buildIdentity(source, capabilities),
    endpoints,
    capabilities,
    presentation: buildPresentation(source, activeLens, capabilities),
    realtime: buildRealtime(source),
    // A channel never carries conversation-only affordances, whatever a caller
    // passes.
    conversationOnly: source.kind === 'conversation' ? conversationOnly : null,
    policy: buildPolicyEcho(source),
  };
};

/** Cache keys for a container, exposed so `useContainer` binds them consistently. */
export const containerQueryKeys = (ref: MessageContainerRef) => ({
  queryKey: messageQueryKey(ref),
  threadQueryKey: (rootMessageId: string) =>
    threadMessageQueryKey(ref, rootMessageId),
});
