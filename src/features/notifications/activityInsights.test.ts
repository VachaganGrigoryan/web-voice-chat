import { describe, expect, it } from 'vitest';
import type { CallHistoryItem, ConnectionListItem, NotificationView } from '@/api/types';
import { buildActivityInsights, getNotificationTone } from './activityInsights';

const baseNotification = (overrides: Partial<NotificationView>): NotificationView => ({
  id: overrides.id ?? 'notification-1',
  user_id: 'user-1',
  kind: overrides.kind ?? 'message_mention',
  actor_user_id: 'user-2',
  resource_type: 'conversation',
  resource_id: 'conversation-1',
  message_id: null,
  read_at: overrides.read_at ?? null,
  data: {},
  created_at: overrides.created_at ?? '2026-08-05T10:00:00.000Z',
  updated_at: overrides.updated_at ?? '2026-08-05T10:00:00.000Z',
});

const connection = (
  id: string,
  status: ConnectionListItem['relationship']['status'],
  updatedAt: string
): ConnectionListItem =>
  ({
    peer: { id, username: id, display_name: id, avatar: null },
    relationship: { status, updated_at: updatedAt },
  }) as ConnectionListItem;

const call = (overrides: Partial<CallHistoryItem>): CallHistoryItem => ({
  id: overrides.id ?? 'call-1',
  peer_user: {
    id: 'peer-1',
    username: 'peer',
    display_name: 'Peer',
    avatar: null,
    is_online: true,
  },
  direction: overrides.direction ?? 'incoming',
  type: overrides.type ?? 'audio',
  status: overrides.status ?? 'ended',
  started_at: overrides.started_at ?? '2026-08-05T09:00:00.000Z',
  answered_at: overrides.answered_at ?? '2026-08-05T09:00:10.000Z',
  ended_at: overrides.ended_at === undefined ? '2026-08-05T09:02:00.000Z' : overrides.ended_at,
  duration_ms: overrides.duration_ms ?? 120000,
  message_id: null,
});

describe('activity insights', () => {
  it('maps notification kinds to stable tones', () => {
    expect(getNotificationTone('message_mention')).toBe('mention');
    expect(getNotificationTone('relationship_request')).toBe('request');
    expect(getNotificationTone('security_alert')).toBe('security');
    expect(getNotificationTone('future_kind')).toBe('system');
  });

  it('derives top metrics from loaded activity data', () => {
    const snapshot = buildActivityInsights({
      now: new Date('2026-08-05T12:00:00.000Z'),
      unreadCount: 2,
      notifications: [
        baseNotification({ id: 'n1', kind: 'message_mention', read_at: null }),
        baseNotification({ id: 'n2', kind: 'comment', read_at: '2026-08-05T11:00:00.000Z' }),
      ],
      incoming: [connection('user-2', 'pending', '2026-08-05T08:00:00.000Z')],
      outgoing: [connection('user-3', 'pending', '2026-08-05T07:00:00.000Z')],
      callHistory: [call({ id: 'c1' }), call({ id: 'c2', status: 'rejected', duration_ms: 0 })],
    });

    expect(snapshot.metrics.map((item) => [item.id, item.value])).toEqual([
      ['unread', 2],
      ['mentions', 1],
      ['requests', 1],
      ['calls', 2],
      ['missed', 1],
    ]);
    expect(snapshot.loadedSignals).toBe(6);
    expect(snapshot.talkTimeMs).toBe(120000);
  });

  it('buckets notifications, requests, and calls into a seven-day trend', () => {
    const snapshot = buildActivityInsights({
      now: new Date('2026-08-05T12:00:00.000Z'),
      unreadCount: 1,
      notifications: [
        baseNotification({ id: 'n1', created_at: '2026-08-05T01:00:00.000Z' }),
        baseNotification({ id: 'n2', kind: 'message_reply', created_at: '2026-08-04T08:00:00.000Z' }),
        baseNotification({ id: 'bad', created_at: 'not-a-date' }),
      ],
      incoming: [connection('user-2', 'pending', '2026-08-05T02:00:00.000Z')],
      outgoing: [],
      callHistory: [call({ started_at: '2026-08-03T04:00:00.000Z', ended_at: null })],
    });

    const today = snapshot.trend.at(-1);
    const yesterday = snapshot.trend.at(-2);
    const twoDaysAgo = snapshot.trend.at(-3);

    expect(today?.label).toBe('Today');
    expect(today?.total).toBe(2);
    expect(today?.unread).toBe(1);
    expect(today?.requests).toBe(1);
    expect(yesterday?.label).toBe('Yesterday');
    expect(yesterday?.mentions).toBe(1);
    expect(twoDaysAgo?.calls).toBe(1);
  });

  it('returns stable empty metrics', () => {
    const snapshot = buildActivityInsights({
      now: new Date('2026-08-05T12:00:00.000Z'),
      unreadCount: 0,
      notifications: [],
      incoming: [],
      outgoing: [],
      callHistory: [],
    });

    expect(snapshot.trend).toHaveLength(7);
    expect(snapshot.trend.every((point) => point.total === 0)).toBe(true);
    expect(snapshot.callBreakdown.every((item) => item.value === 0)).toBe(true);
    expect(snapshot.loadedSignals).toBe(0);
  });
});
