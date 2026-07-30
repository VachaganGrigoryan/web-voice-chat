import type {
  AvatarMeta,
  Channel,
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  ChannelViewerState,
  ChannelVisibility,
  Conversation,
  MessageContainerRef,
  MessageDoc,
  PaginatedResponse,
  PostingPolicy,
  PresenceState,
} from '@/api/types';

/**
 * `container_type` answers three unrelated questions at once — which URL to
 * call, what the viewer may do, and how to render. Reading it for all three is
 * why the chat hook needed non-null assertions and `any` casts.
 *
 * The descriptor splits those axes:
 *   transport    -> `endpoints`     varies with the container type
 *   policy       -> `capabilities`  varies with the viewer, server-authoritative
 *   presentation -> `presentation`  varies with the lens, i.e. the route
 *
 * Capabilities are lens-invariant. That property is what lets one adapter serve
 * both lenses instead of two adapters or a discriminated union, and it is
 * asserted in `resolveContainer.test.ts`.
 */

/** Chosen by the route, never derived from the source. */
export type ContainerLens = 'timeline' | 'feed';

export type ContainerSource =
  | { readonly kind: 'conversation'; readonly conversation: Conversation }
  | {
      readonly kind: 'channel';
      readonly channel: Channel;
      readonly state: ChannelViewerState | null;
    };

// --- identity ---------------------------------------------------------------

export type ContainerBadge = 'dm' | 'group' | 'channel' | 'profile-channel';

export interface ContainerRoutes {
  /** Where this container opens in the chat lens. */
  readonly chat: string;
  /** Where it opens in the social lens; conversations have no social surface. */
  readonly social: string | null;
  /** Management subtree entry, or null when the viewer may not manage it. */
  readonly manage: string | null;
  readonly thread: (rootMessageId: string) => string;
}

export interface ContainerIdentity {
  readonly title: string;
  readonly subtitle: string | null;
  readonly avatar: AvatarMeta | null;
  readonly badge: ContainerBadge;
  readonly ownerRef: { readonly type: 'user' | 'space'; readonly id: string } | null;
  readonly spaceId: string | null;
  readonly routes: ContainerRoutes;
}

// --- transport --------------------------------------------------------------

export interface HistoryParams {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface SendTextBody {
  readonly text: string;
  readonly reply_mode?: 'quote' | 'thread' | null;
  readonly reply_to_message_id?: string | null;
}

/**
 * Pre-bound closures rather than a URL builder: the call site should not be able
 * to reach a container's transport without going through its descriptor.
 */
export interface ContainerEndpoints {
  readonly ref: MessageContainerRef;
  readonly history: (params: HistoryParams) => Promise<PaginatedResponse<MessageDoc>>;
  readonly threadHistory: (rootMessageId: string) => Promise<MessageDoc[]>;
  readonly sendText: (body: SendTextBody) => Promise<MessageDoc>;
  /** The caller owns the file, progress and cancellation; the ref is applied here. */
  readonly sendMedia: (payload: Record<string, unknown>) => Promise<MessageDoc>;
  readonly sendContent: (body: Record<string, unknown>) => Promise<MessageDoc>;
  /** Both container types support this; it is not a conversation-only affordance. */
  readonly markRead: () => Promise<unknown>;
  readonly queryKey: readonly unknown[];
  readonly threadQueryKey: (rootMessageId: string) => readonly unknown[];
}

// --- policy -----------------------------------------------------------------

/** Whether the values came from the server or the local policy fallback. */
export type CapabilitySource = 'server' | 'policy-fallback';

export type ViewerMembership =
  | 'owner'
  | 'member'
  | 'pending'
  | 'follower'
  | 'guest';

/** What the container offers a viewer who is not yet in it. */
export type JoinAffordance =
  | 'none'
  | 'join'
  | 'request'
  | 'follow'
  | 'invite-only';

export interface ContainerCapabilities {
  readonly canRead: boolean;
  readonly canPost: boolean;
  readonly canComment: boolean;
  readonly canReplyInline: boolean;
  readonly canStartThread: boolean;
  readonly canReact: boolean;
  readonly canUploadMedia: boolean;
  readonly canCreatePoll: boolean;
  readonly canStartCall: boolean;
  readonly canEditOwn: boolean;
  readonly canEditAny: boolean;
  readonly canDeleteOwn: boolean;
  readonly canDeleteAny: boolean;
  /** Always false for channels: the backend rejects pinning a channel message. */
  readonly canPin: boolean;
  /** Always false for channels: forward targets must be conversations. */
  readonly canForward: boolean;
  readonly canManage: boolean;
  readonly canManageMembers: boolean;
  readonly canManageRoles: boolean;
  readonly canInvite: boolean;
  readonly canApproveJoins: boolean;
  readonly canDeleteContainer: boolean;
  readonly membership: ViewerMembership;
  readonly joinAffordance: JoinAffordance;
  readonly source: CapabilitySource;
}

/** Raw policy for management forms to render and edit. Never used for gating. */
export type ContainerPolicyEcho =
  | {
      readonly kind: 'conversation';
      readonly postingPolicy: PostingPolicy;
      readonly visibility: Conversation['visibility'];
    }
  | {
      readonly kind: 'channel';
      readonly postingPolicy: ChannelPostingPolicy;
      readonly commentPolicy: ChannelCommentPolicy;
      readonly visibility: ChannelVisibility;
      readonly joinPolicy: Channel['join_policy'];
    };

// --- conversation-only affordances -----------------------------------------

/**
 * An absent object rather than a bag of `false` flags, so a channel cannot
 * accidentally render a draft box or a typing indicator.
 *
 * Marking a container read is deliberately NOT here — channels have their own
 * read endpoint and unread count, so it lives on `endpoints.markRead`. What is
 * genuinely conversation-shaped is the per-message delivery/read receipt.
 */
export interface ConversationOnlyAffordances {
  readonly typing: {
    readonly start: () => void;
    readonly stop: () => void;
    readonly typingUserIds: readonly string[];
  };
  readonly receipts: {
    readonly enabled: boolean;
    readonly markDelivered: (messageId: string) => Promise<unknown>;
  };
  readonly drafts: {
    readonly value: string | null;
    readonly save: (text: string) => Promise<unknown>;
    readonly clear: () => Promise<unknown>;
  };
  readonly folder: {
    readonly current: string | null;
    readonly move: (folder: string | null) => Promise<unknown>;
  };
  readonly pins: {
    readonly ids: readonly string[];
    readonly toggle: (messageId: string) => Promise<unknown>;
  };
  readonly forward: (
    messageId: string,
    targetConversationId: string
  ) => Promise<MessageDoc>;
  readonly presence: {
    readonly peerUserId: string | null;
    readonly state: PresenceState | null;
  };
}

// --- presentation -----------------------------------------------------------

export interface ContainerPresentation {
  readonly lens: ContainerLens;
  readonly rootItem: 'message-row' | 'post-card';
  readonly replyItem: 'message-row' | 'comment-row';
  readonly order: 'newest-at-bottom' | 'newest-first';
  readonly threadDisplay: 'side-panel' | 'inline-expand' | 'route';
  readonly composer: 'inline-bar' | 'post-box' | 'none';
  readonly groupConsecutive: boolean;
  readonly showReadReceipts: boolean;
  readonly showTypingIndicator: boolean;
  readonly emptyState: 'no-messages' | 'no-posts' | 'locked';
}

// --- realtime ---------------------------------------------------------------

export interface ContainerEnvelope {
  readonly container_type?: string | null;
  readonly container_id?: string | null;
  /** @deprecated Legacy mirror of `container_id`; tolerated during rollout. */
  readonly conversation_id?: string | null;
}

export interface ContainerRealtime {
  readonly matchesMessage: (event: ContainerEnvelope) => boolean;
  readonly matchesStatus: (event: ContainerEnvelope) => boolean;
  /** Always false for channels — the server has no channel typing event. */
  readonly matchesTyping: (event: ContainerEnvelope) => boolean;
  readonly matchesRead: (event: ContainerEnvelope) => boolean;
  readonly matchesPins: (event: ContainerEnvelope) => boolean;
  /** Every container delivers live now: channels broadcast to their own room. */
  readonly reliability: 'live';
}

// --- the descriptor ---------------------------------------------------------

export interface ContainerDescriptor {
  readonly ref: MessageContainerRef;
  /** Escape hatch for the rare consumer that needs the raw entity. */
  readonly source: ContainerSource;
  readonly identity: ContainerIdentity;
  readonly endpoints: ContainerEndpoints;
  readonly capabilities: ContainerCapabilities;
  readonly presentation: ContainerPresentation;
  readonly realtime: ContainerRealtime;
  readonly conversationOnly: ConversationOnlyAffordances | null;
  readonly policy: ContainerPolicyEcho;
}
