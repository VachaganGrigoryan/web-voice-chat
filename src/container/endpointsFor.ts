import { channelsApi, messagesApi } from '@/api/endpoints';
import { messageQueryKey, threadMessageQueryKey } from '@/api/queryKeys';
import type { MessageContainerRef, MessageDoc } from '@/api/types';
import type { ContainerEndpoints, ContainerSource } from './types';
import { refOf } from './resolveContainer';

/**
 * Binds a container to its transport once, so no component chooses a URL.
 *
 * Only *collection* operations are here. Item operations (edit, delete, react,
 * thread) are already flat and container-agnostic server-side, so they live on
 * `useMessageActions`, which needs the descriptor for cache targeting and
 * gating rather than for routing.
 */
export const endpointsFor = (source: ContainerSource): ContainerEndpoints => {
  const ref: MessageContainerRef = refOf(source);
  const isChannel = ref.container_type === 'channel';

  return {
    ref,
    history: ({ limit = 20, cursor } = {}) => messagesApi.getHistory(ref, limit, cursor),
    threadHistory: (rootMessageId) => messagesApi.getThreadMessages(rootMessageId),
    sendText: (body) =>
      messagesApi.sendText({
        ...ref,
        text: body.text,
        reply_mode: body.reply_mode,
        reply_to_message_id: body.reply_to_message_id ?? undefined,
      }),
    /**
     * `messagesApi.uploadMedia` already accepts a container ref and owns form
     * construction, progress and cancellation, so the descriptor passes the
     * caller's payload straight through rather than rebuilding it.
     */
    sendMedia: (payload) =>
      messagesApi.uploadMedia({ ...payload, ...ref } as never) as Promise<MessageDoc>,
    sendContent: (body) =>
      messagesApi.sendRichContent({ ...(body as object), ...ref } as never),
    markRead: () =>
      isChannel
        ? channelsApi.markRead(ref.container_id)
        : messagesApi.markConversationRead(ref.container_id),
    queryKey: messageQueryKey(ref),
    threadQueryKey: (rootMessageId: string) => threadMessageQueryKey(ref, rootMessageId),
  };
};
