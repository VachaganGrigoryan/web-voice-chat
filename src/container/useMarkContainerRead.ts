import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import { resetContainerUnreadCount } from './messageCache';
import type { ContainerDescriptor } from './types';

/**
 * Marks the open container read and clears its unread badge — both container
 * types support this through `descriptor.endpoints.markRead`, so the caller
 * never distinguishes a conversation from a channel.
 */
export function useMarkContainerRead(descriptor: ContainerDescriptor | null) {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);
  const containerType = descriptor?.ref.container_type;
  const containerId = descriptor?.ref.container_id;

  useEffect(() => {
    if (!descriptor) return;

    void descriptor.endpoints.markRead();
    resetContainerUnreadCount(queryClient, descriptor.ref);

    if (descriptor.ref.container_type === 'conversation') {
      socket?.emit(EVENTS.CONVERSATION_READ, { conversation_id: descriptor.ref.container_id });
    }
    // Keyed on the container's identity, not the descriptor object, so a
    // capability refresh doesn't re-fire this as a side effect.
  }, [containerType, containerId]);
}
