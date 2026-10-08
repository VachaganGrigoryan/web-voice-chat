import { describe, expect, it } from 'vitest';
import { createChannelRoomRegistry, type RoomSocket } from './channelRooms';
import { EVENTS } from './events';

interface Emitted {
  event: string;
  channelId: string;
}

const fakeSocket = (id: string) => {
  const emitted: Emitted[] = [];
  const socket: RoomSocket = {
    id,
    emit: (event, payload) => {
      emitted.push({
        event,
        channelId: (payload as { channel_id: string }).channel_id,
      });
    },
  };
  return { socket, emitted };
};

const joins = (emitted: Emitted[]) =>
  emitted.filter((entry) => entry.event === EVENTS.JOIN_CHANNEL).map((e) => e.channelId);
const leaves = (emitted: Emitted[]) =>
  emitted.filter((entry) => entry.event === EVENTS.LEAVE_CHANNEL).map((e) => e.channelId);

describe('channelRooms', () => {
  it('joins a room once however many surfaces hold it', () => {
    const registry = createChannelRoomRegistry();
    const { socket, emitted } = fakeSocket('s1');

    registry.acquire(socket, ['ch_1']);
    registry.acquire(socket, ['ch_1']);

    expect(joins(emitted)).toEqual(['ch_1']);
  });

  it('leaves only when the last holder releases', () => {
    const registry = createChannelRoomRegistry();
    const { socket, emitted } = fakeSocket('s1');

    registry.acquire(socket, ['ch_1']);
    registry.acquire(socket, ['ch_1']);
    registry.release(socket, ['ch_1']);

    expect(leaves(emitted)).toEqual([]);

    registry.release(socket, ['ch_1']);

    expect(leaves(emitted)).toEqual(['ch_1']);
  });

  it('joins a repeated id in one acquire once, and leaves it once', () => {
    const registry = createChannelRoomRegistry();
    const { socket, emitted } = fakeSocket('s1');

    // A feed page carries many posts from the same channel.
    registry.acquire(socket, ['ch_1', 'ch_1', 'ch_2']);
    registry.release(socket, ['ch_1', 'ch_1', 'ch_2']);

    expect(joins(emitted)).toEqual(['ch_1', 'ch_2']);
    expect(leaves(emitted)).toEqual(['ch_1', 'ch_2']);
  });

  it('rejoins everything still held on a new connection', () => {
    const registry = createChannelRoomRegistry();
    const first = fakeSocket('s1');
    registry.acquire(first.socket, ['ch_1', 'ch_2']);

    // The server remembers no rooms for a socket it has not seen.
    const second = fakeSocket('s2');
    registry.reconcile(second.socket);

    expect(joins(second.emitted)).toEqual(['ch_1', 'ch_2']);
    expect(leaves(second.emitted)).toEqual([]);
  });

  it('does not rejoin a room already joined on this connection', () => {
    const registry = createChannelRoomRegistry();
    const { socket, emitted } = fakeSocket('s1');

    registry.acquire(socket, ['ch_1']);
    registry.reconcile(socket);
    registry.reconcile(socket);

    expect(joins(emitted)).toEqual(['ch_1']);
  });

  it('ignores an empty id rather than joining a room with no name', () => {
    const registry = createChannelRoomRegistry();
    const { socket, emitted } = fakeSocket('s1');

    registry.acquire(socket, ['']);

    expect(emitted).toEqual([]);
  });
});
