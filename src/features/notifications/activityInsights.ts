import type { CallHistoryItem, ConnectionListItem, NotificationView } from '@/api/types';

export type ActivityTone = 'brand' | 'mention' | 'request' | 'call' | 'system' | 'security';

export interface ActivityTrendPoint {
  key: string;
  label: string;
  total: number;
  unread: number;
  mentions: number;
  requests: number;
  calls: number;
}

export interface ActivityMetric {
  readonly id: 'unread' | 'mentions' | 'requests' | 'calls' | 'missed';
  readonly label: string;
  readonly value: number;
  readonly tone: ActivityTone;
  readonly detail: string;
}

export interface ActivityBreakdownItem {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly tone: ActivityTone;
}

export interface ActivityInsightSnapshot {
  readonly metrics: readonly ActivityMetric[];
  readonly trend: readonly ActivityTrendPoint[];
  readonly notificationBreakdown: readonly ActivityBreakdownItem[];
  readonly callBreakdown: readonly ActivityBreakdownItem[];
  readonly talkTimeMs: number;
  readonly loadedSignals: number;
}

interface ActivityInsightInput {
  readonly notifications: readonly NotificationView[];
  readonly incoming: readonly ConnectionListItem[];
  readonly outgoing: readonly ConnectionListItem[];
  readonly callHistory: readonly CallHistoryItem[];
  readonly unreadCount: number;
  readonly now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function getNotificationTone(kind: string): ActivityTone {
  if (kind === 'message_mention' || kind === 'message_reply') return 'mention';
  if (kind === 'relationship_request' || kind === 'ping') return 'request';
  if (kind === 'security_alert') return 'security';
  if (kind === 'comment' || kind === 'comment_reply' || kind === 'thread_reply') return 'brand';
  return 'system';
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function dayLabel(date: Date, today: Date): string {
  const diff = Math.round(
    (startOfLocalDay(today).getTime() - startOfLocalDay(date).getTime()) / DAY_MS
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function pending(items: readonly ConnectionListItem[]): number {
  return items.filter((item) => item.relationship.status === 'pending').length;
}

function plural(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}

export function buildActivityInsights({
  notifications,
  incoming,
  outgoing,
  callHistory,
  unreadCount,
  now = new Date(),
}: ActivityInsightInput): ActivityInsightSnapshot {
  const today = startOfLocalDay(now);
  const trend = Array.from({ length: 7 }, (_, index): ActivityTrendPoint => {
    const date = new Date(today.getTime() - (6 - index) * DAY_MS);
    return {
      key: dayKey(date),
      label: dayLabel(date, now),
      total: 0,
      unread: 0,
      mentions: 0,
      requests: 0,
      calls: 0,
    };
  });
  const trendByKey = new Map(trend.map((point) => [point.key, point]));

  const mentionCount = notifications.filter(
    (item) => item.kind === 'message_mention' || item.kind === 'message_reply'
  ).length;
  const pendingIncoming = pending(incoming);
  const pendingOutgoing = pending(outgoing);
  const missedCalls = callHistory.filter((item) => item.status !== 'ended').length;
  const talkTimeMs = callHistory.reduce((total, item) => total + Math.max(item.duration_ms, 0), 0);

  for (const notification of notifications) {
    const createdAt = parseDate(notification.created_at);
    if (!createdAt) continue;
    const point = trendByKey.get(dayKey(startOfLocalDay(createdAt)));
    if (!point) continue;
    const tone = getNotificationTone(notification.kind);
    point.total += 1;
    if (!notification.read_at) point.unread += 1;
    if (tone === 'mention') point.mentions += 1;
    if (tone === 'request') point.requests += 1;
  }

  for (const item of incoming) {
    const updatedAt = parseDate(item.relationship.updated_at);
    if (!updatedAt || item.relationship.status !== 'pending') continue;
    const point = trendByKey.get(dayKey(startOfLocalDay(updatedAt)));
    if (point) {
      point.total += 1;
      point.requests += 1;
    }
  }

  for (const item of callHistory) {
    const timestamp = parseDate(item.ended_at || item.started_at);
    if (!timestamp) continue;
    const point = trendByKey.get(dayKey(startOfLocalDay(timestamp)));
    if (point) {
      point.total += 1;
      point.calls += 1;
    }
  }

  const notificationBreakdown: ActivityBreakdownItem[] = [
    { id: 'mentions', label: 'Mentions', value: mentionCount, tone: 'mention' },
    {
      id: 'requests',
      label: 'Requests',
      value: pendingIncoming + pendingOutgoing,
      tone: 'request',
    },
    {
      id: 'comments',
      label: 'Comments',
      value: notifications.filter((item) =>
        ['comment', 'comment_reply', 'thread_reply'].includes(item.kind)
      ).length,
      tone: 'brand',
    },
    {
      id: 'system',
      label: 'System',
      value: notifications.filter((item) => getNotificationTone(item.kind) === 'system').length,
      tone: 'system',
    },
  ];

  const callBreakdown: ActivityBreakdownItem[] = [
    {
      id: 'audio',
      label: 'Audio',
      value: callHistory.filter((item) => item.type === 'audio').length,
      tone: 'call',
    },
    {
      id: 'video',
      label: 'Video',
      value: callHistory.filter((item) => item.type === 'video').length,
      tone: 'brand',
    },
    {
      id: 'incoming',
      label: 'Incoming',
      value: callHistory.filter((item) => item.direction === 'incoming').length,
      tone: 'request',
    },
    {
      id: 'missed',
      label: 'Missed',
      value: missedCalls,
      tone: 'security',
    },
  ];

  return {
    metrics: [
      {
        id: 'unread',
        label: 'Unread signals',
        value: unreadCount,
        tone: 'brand',
        detail: unreadCount ? `${plural(unreadCount, 'item')} waiting` : 'Inbox is clear',
      },
      {
        id: 'mentions',
        label: 'Mentions',
        value: mentionCount,
        tone: 'mention',
        detail: mentionCount ? 'Direct attention' : 'No direct mentions',
      },
      {
        id: 'requests',
        label: 'Requests',
        value: pendingIncoming,
        tone: 'request',
        detail: pendingOutgoing
          ? `${plural(pendingOutgoing, 'sent request')} pending`
          : 'No outgoing wait',
      },
      {
        id: 'calls',
        label: 'Calls loaded',
        value: callHistory.length,
        tone: 'call',
        detail: talkTimeMs ? `${Math.round(talkTimeMs / 60000)} min talk time` : 'No talk time',
      },
      {
        id: 'missed',
        label: 'Missed / ended early',
        value: missedCalls,
        tone: 'security',
        detail: missedCalls ? 'Needs review' : 'No unresolved calls',
      },
    ],
    trend,
    notificationBreakdown,
    callBreakdown,
    talkTimeMs,
    loadedSignals: notifications.length + pendingIncoming + pendingOutgoing + callHistory.length,
  };
}
