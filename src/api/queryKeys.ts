import type { MessageContainerRef } from './types';

export const messageQueryKey = (container: MessageContainerRef) =>
  ['messages', container.container_type, container.container_id] as const;

export const threadMessageQueryKey = (
  container: MessageContainerRef,
  threadRootId: string
) =>
  [
    'threadMessages',
    container.container_type,
    container.container_id,
    threadRootId,
  ] as const;
