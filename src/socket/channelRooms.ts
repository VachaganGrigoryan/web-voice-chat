import { EVENTS } from './events';

/**
 * Who is watching which channel room.
 *
 * A channel broadcasts to `channel:{id}` and to nothing else, so a surface that
 * renders its posts has to join. Several surfaces can render the same channel at
 * once — a post detail route over a feed, a feed beside the chat — which is why
 * membership is reference counted: an unmounting surface must not evict a room
 * another one is still reading from.
 *
 * Rooms live on the server for the length of one connection, so what has actually
 * been emitted is tracked against the socket that received it. A reconnect brings
 * a new socket id, and everything still held is joined again.
 */

/** The part of a Socket.IO client this needs — a test supplies its own. */
export interface RoomSocket {
  readonly id?: string;
  emit: (event: string, payload: unknown) => unknown;
}

export interface ChannelRoomRegistry {
  /** Take a hold on each room, joining the ones nobody held yet. */
  acquire: (socket: RoomSocket, channelIds: readonly string[]) => void;
  /** Drop a hold on each room, leaving the ones nobody holds any more. */
  release: (socket: RoomSocket, channelIds: readonly string[]) => void;
  /** Bring the server's rooms in line with what is held, on this connection. */
  reconcile: (socket: RoomSocket) => void;
}

export const createChannelRoomRegistry = (): ChannelRoomRegistry => {
  const held = new Map<string, number>();
  let joined: { socketId: string | null; rooms: Set<string> } = {
    socketId: null,
    rooms: new Set(),
  };

  const reconcile = (socket: RoomSocket) => {
    const socketId = socket.id ?? null;
    if (joined.socketId !== socketId) {
      // A different connection: the server remembers none of the old rooms, so
      // everything held is joined again rather than assumed present.
      joined = { socketId, rooms: new Set() };
    }

    for (const channelId of held.keys()) {
      if (joined.rooms.has(channelId)) continue;
      socket.emit(EVENTS.JOIN_CHANNEL, { channel_id: channelId });
      joined.rooms.add(channelId);
    }

    for (const channelId of [...joined.rooms]) {
      if (held.has(channelId)) continue;
      socket.emit(EVENTS.LEAVE_CHANNEL, { channel_id: channelId });
      joined.rooms.delete(channelId);
    }
  };

  return {
    acquire: (socket, channelIds) => {
      for (const channelId of new Set(channelIds)) {
        if (!channelId) continue;
        held.set(channelId, (held.get(channelId) ?? 0) + 1);
      }
      reconcile(socket);
    },
    release: (socket, channelIds) => {
      for (const channelId of new Set(channelIds)) {
        const count = held.get(channelId);
        if (!count) continue;
        if (count === 1) held.delete(channelId);
        else held.set(channelId, count - 1);
      }
      reconcile(socket);
    },
    reconcile,
  };
};

/** The app's registry. One per client, since there is one socket. */
export const channelRooms = createChannelRoomRegistry();
