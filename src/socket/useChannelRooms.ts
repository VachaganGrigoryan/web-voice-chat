import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { MessageReactionsUpdate } from '@/api/types';
import {
  applyReactionUpdateToFeeds,
  invalidateChannelFeeds,
} from '@/container/messageCache';
import { channelRooms } from './channelRooms';
import { EVENTS } from './events';
import { useSocketStore } from './socket';

/** Any channel event, read only for the container it names. */
interface ChannelEvent {
  container_type?: string;
  container_id?: string;
  /** `thread_reply_created` sometimes wraps the message in a summary envelope. */
  message?: { container_type?: string; container_id?: string };
}

const channelIdOf = (payload: ChannelEvent | null | undefined): string | null => {
  const event = payload?.message ?? payload;
  if (!event || event.container_type !== 'channel') return null;
  return event.container_id ?? null;
};

/**
 * Join the rooms these channels broadcast to, for as long as the caller is shown.
 *
 * The hold is shared through `channelRooms`, so two surfaces watching the same
 * channel join it once and neither unmounting evicts the other. `isConnected` is a
 * dependency because a reconnect drops every room the server was holding.
 */
export function useChannelRooms(channelIds: readonly string[]): void {
  const socket = useSocketStore((state) => state.socket);
  const isConnected = useSocketStore((state) => state.isConnected);
  const idsKey = Array.from(new Set(channelIds.filter(Boolean))).join('|');

  useEffect(() => {
    if (!socket || !isConnected || !idsKey) return;
    const ids = idsKey.split('|');
    channelRooms.acquire(socket, ids);
    return () => channelRooms.release(socket, ids);
  }, [socket, isConnected, idsKey]);
}

/**
 * The rooms plus the handlers a surface outside the chat page needs.
 *
 * `useRealtimeMessages` is mounted by `ChatPage` alone, so without this a feed
 * would be subscribed to channels whose events nothing listens for. Everything
 * here is a cache refresh and nothing more — no delivery acknowledgement, no
 * unread arithmetic, no notification — which is what makes it safe to run
 * alongside the chat page's handlers: a duplicate is a no-op, not a double count.
 */
export function useRealtimeChannelPosts(channelIds: readonly string[]): void {
  const socket = useSocketStore((state) => state.socket);
  const queryClient = useQueryClient();

  useChannelRooms(channelIds);

  useEffect(() => {
    if (!socket) return;

    const refreshFeeds = (payload: ChannelEvent) => {
      const channelId = channelIdOf(payload);
      if (channelId) invalidateChannelFeeds(queryClient, channelId);
    };

    // Written in place rather than invalidated, so a post keeps its optimistic
    // reaction until the server's own count replaces it.
    const applyReaction = (payload: MessageReactionsUpdate) => {
      applyReactionUpdateToFeeds(queryClient, payload.message_id, payload.reactions);
    };

    socket.on(EVENTS.RECEIVE_MESSAGE, refreshFeeds);
    socket.on(EVENTS.THREAD_REPLY_CREATED, refreshFeeds);
    socket.on(EVENTS.MESSAGE_EDITED, refreshFeeds);
    socket.on(EVENTS.MESSAGE_DELETED, refreshFeeds);
    socket.on(EVENTS.MESSAGE_REACTED, applyReaction);

    return () => {
      socket.off(EVENTS.RECEIVE_MESSAGE, refreshFeeds);
      socket.off(EVENTS.THREAD_REPLY_CREATED, refreshFeeds);
      socket.off(EVENTS.MESSAGE_EDITED, refreshFeeds);
      socket.off(EVENTS.MESSAGE_DELETED, refreshFeeds);
      socket.off(EVENTS.MESSAGE_REACTED, applyReaction);
    };
  }, [socket, queryClient]);
}
