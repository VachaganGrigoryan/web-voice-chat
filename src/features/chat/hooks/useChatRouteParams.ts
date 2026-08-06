import { useParams } from 'react-router-dom';
import { CHAT_RESERVED_SEGMENTS } from '@/app/routes';

export interface ChatRouteParams {
  readonly conversationId: string | null;
  readonly channelId: string | null;
  readonly rootMessageId: string | null;
  readonly spaceId: string | null;
}

const isReservedSegment = (value: string): boolean =>
  (CHAT_RESERVED_SEGMENTS as readonly string[]).includes(value);

/**
 * The single parser of `/chat/*` route params. `channelId` and `conversationId`
 * are mutually exclusive by route shape, but a reserved segment is rejected
 * here too rather than trusted, so a route added later can't silently be read
 * as a conversation id.
 */
export function useChatRouteParams(): ChatRouteParams {
  const params = useParams<{
    spaceId?: string;
    conversationId?: string;
    channelId?: string;
    rootMessageId?: string;
  }>();

  const conversationId =
    params.conversationId && !isReservedSegment(params.conversationId)
      ? params.conversationId
      : null;

  return {
    conversationId,
    channelId: params.channelId ?? null,
    rootMessageId: params.rootMessageId ?? null,
    spaceId: params.spaceId ?? null,
  };
}
