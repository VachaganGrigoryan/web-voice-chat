import { describe, expect, it } from 'vitest';
import type { ChannelInboxRow, Conversation } from '@/api/types';
import {
  formatConversationTimestamp,
  getConversationLabel,
  isChannelRowMuted,
  resolveConversationPreview,
  shortenMessageText,
} from './inboxPreview';

type LastMessage = NonNullable<Conversation['last_message']>;

const conversation = (overrides: Partial<Conversation> = {}): Conversation =>
  ({ type: 'dm', peer_user: null, last_message: null, ...overrides }) as Conversation;

const message = (overrides: Partial<LastMessage> = {}): LastMessage =>
  ({ type: 'text', text: 'hi', media: null, call: null, ...overrides }) as LastMessage;

describe('shortenMessageText', () => {
  it('falls back for empty text', () => {
    expect(shortenMessageText(null)).toBe('Click to chat');
  });

  it('truncates past the limit with an ellipsis', () => {
    const long = 'a'.repeat(60);
    expect(shortenMessageText(long, 10)).toBe('a'.repeat(10) + '…');
  });

  it('collapses internal whitespace', () => {
    expect(shortenMessageText('hello   world')).toBe('hello world');
  });
});

describe('formatConversationTimestamp', () => {
  it('returns empty string for no value', () => {
    expect(formatConversationTimestamp(null)).toBe('');
  });
});

describe('getConversationLabel', () => {
  it('prefers a group title', () => {
    expect(getConversationLabel(conversation({ type: 'group', title: 'Team' }))).toBe('Team');
  });

  it('falls back to "Group chat" when untitled', () => {
    expect(getConversationLabel(conversation({ type: 'group', title: null }))).toBe('Group chat');
  });

  it('flags a ghost peer', () => {
    expect(
      getConversationLabel(
        conversation({ peer_user: { is_ghost: true } as Conversation['peer_user'] })
      )
    ).toBe('Ghost chat');
  });

  it('prefers display name over username', () => {
    expect(
      getConversationLabel(
        conversation({
          peer_user: { display_name: 'Ada', username: 'ada99', id: 'u1' } as Conversation['peer_user'],
        })
      )
    ).toBe('Ada');
  });
});

describe('resolveConversationPreview', () => {
  it('invites a ping for a ghost with no history', () => {
    expect(
      resolveConversationPreview(
        conversation({ last_message: null, peer_user: { is_ghost: true } as Conversation['peer_user'] }),
        'me'
      )
    ).toEqual({ kind: 'text', text: 'Send a ping to reconnect' });
  });

  it('shows "Click to chat" for a fresh conversation', () => {
    expect(resolveConversationPreview(conversation({ last_message: null }), 'me')).toEqual({
      kind: 'text',
      text: 'Click to chat',
    });
  });

  it('renders a voice message as an icon when there is no caption', () => {
    expect(
      resolveConversationPreview(
        conversation({
          last_message: message({
            type: 'media',
            media: { kind: 'voice' } as LastMessage['media'],
            text: '',
          }),
        }),
        'me'
      )
    ).toEqual({ kind: 'icon', icon: 'voice', label: 'Voice message' });
  });

  it('prefers a poll question over the generic icon', () => {
    expect(
      resolveConversationPreview(
        conversation({ last_message: message({ type: 'poll', text: 'Lunch?' }) }),
        'me'
      )
    ).toEqual({ kind: 'text', text: 'Lunch?' });
  });

  it('falls back to text for a plain text message', () => {
    expect(
      resolveConversationPreview(conversation({ last_message: message({ type: 'text', text: 'Hey there' }) }), 'me')
    ).toEqual({ kind: 'text', text: 'Hey there' });
  });
});

describe('isChannelRowMuted', () => {
  const row = (state: Partial<ChannelInboxRow['state']>): Pick<ChannelInboxRow, 'state'> => ({
    state: { notification_level: 'all', muted_until: null, ...state } as ChannelInboxRow['state'],
  });

  it('is false when notifications are on and nothing is muted', () => {
    expect(isChannelRowMuted(row({}))).toBe(false);
  });

  it('is true when the notification level is none', () => {
    expect(isChannelRowMuted(row({ notification_level: 'none' }))).toBe(true);
  });

  it('is true while a mute window is still active', () => {
    expect(
      isChannelRowMuted(row({ muted_until: new Date(Date.now() + 60_000).toISOString() }))
    ).toBe(true);
  });

  it('is false once a mute window has expired', () => {
    expect(
      isChannelRowMuted(row({ muted_until: new Date(Date.now() - 60_000).toISOString() }))
    ).toBe(false);
  });
});
