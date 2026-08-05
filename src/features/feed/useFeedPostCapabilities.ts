import { useMemo } from 'react';
import { ACTION, useCapabilities } from '@/container';
import type { ResourceRef } from '@/api/types';

export interface FeedPostCapabilities {
  readonly canPost: boolean;
  readonly canComment: boolean;
  readonly canReact: boolean;
  readonly canManage: boolean;
}

const FALLBACK: FeedPostCapabilities = {
  canPost: false,
  canComment: false,
  canReact: false,
  canManage: false,
};

export interface FeedCapabilitiesResult {
  readonly for: (channelId: string) => FeedPostCapabilities;
  readonly isLoading: boolean;
}

/**
 * Capabilities for the channels a feed's posts came from.
 *
 * A home or profile feed carries posts from many channels, so there is no single
 * container descriptor to gate on — which is why the post card takes resolved
 * capabilities per post rather than a descriptor. Resolution goes through the
 * shared batch hook, so the whole visible page costs one request and a card
 * shares its cache entry with the chat header for the same channel.
 *
 * The server caps a batch at fifty resources; a feed page is thirty posts and
 * distinct channels are usually far fewer, so one page is one request.
 */
export function useFeedPostCapabilities(
  channelIds: readonly string[]
): FeedCapabilitiesResult {
  const refs = useMemo<ResourceRef[]>(() => {
    const unique = Array.from(new Set(channelIds.filter(Boolean)));
    return unique.map((id) => ({ type: 'channel', id }));
  }, [channelIds.join('|')]);

  const { byId, status } = useCapabilities(refs);

  return useMemo(
    () => ({
      for: (channelId: string): FeedPostCapabilities => {
        const view = byId.get(`channel:${channelId}`);
        if (!view) return FALLBACK;

        const allowed = new Set(view.allowed);
        return {
          canPost: allowed.has(ACTION.messageCreate),
          canComment: allowed.has(ACTION.threadReply),
          canReact: allowed.has(ACTION.reactionCreate),
          canManage: allowed.has(ACTION.resourceManage),
        };
      },
      isLoading: status === 'idle' || status === 'pending',
    }),
    [byId, status]
  );
}
