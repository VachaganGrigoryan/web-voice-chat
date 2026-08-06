import { describe, expect, it } from 'vitest';
import { buildHeaderActionIds, type HeaderActionInput } from './headerActions';

const base: HeaderActionInput = {
  kind: 'dm',
  hasConversationOnly: true,
  canStartCall: true,
  isPingAccepted: true,
  canPing: true,
};

const dm = (overrides: Partial<HeaderActionInput> = {}) =>
  buildHeaderActionIds({ ...base, ...overrides });

const group = (overrides: Partial<HeaderActionInput> = {}) =>
  buildHeaderActionIds({ ...base, kind: 'group', ...overrides });

const channel = (overrides: Partial<HeaderActionInput> = {}) =>
  buildHeaderActionIds({
    ...base,
    kind: 'channel',
    hasConversationOnly: false,
    canStartCall: false,
    canPing: false,
    ...overrides,
  });

describe('header actions', () => {
  it('gives a direct message its full set', () => {
    expect(dm()).toEqual([
      'audio_call',
      'video_call',
      'saved',
      'scheduled',
      'notifications',
      'chat_pin',
      'folder',
      'archive',
      'settings',
    ]);
  });

  it('offers ping instead of calls before the handshake is accepted', () => {
    const ids = dm({ isPingAccepted: false });
    expect(ids).toContain('send_ping');
    expect(ids).not.toContain('audio_call');
    expect(ids).not.toContain('video_call');
  });

  it('does not offer calls or ping in a group', () => {
    const ids = group();
    expect(ids).not.toContain('audio_call');
    expect(ids).not.toContain('video_call');
    expect(ids).not.toContain('send_ping');
  });

  it('gives a channel the inbox and notification actions it always supported', () => {
    const ids = channel();
    expect(ids).toContain('notifications');
    expect(ids).toContain('chat_pin');
    expect(ids).toContain('archive');
  });

  it('omits conversation-only affordances from a channel', () => {
    const ids = channel();
    expect(ids).not.toContain('folder');
    expect(ids).not.toContain('saved');
    expect(ids).not.toContain('scheduled');
  });

  it('offers settings for every container kind', () => {
    expect(dm()).toContain('settings');
    expect(group()).toContain('settings');
    expect(channel()).toContain('settings');
  });

  it('never returns a channel an empty action list', () => {
    // The regression this whole module exists to prevent.
    expect(channel().length).toBeGreaterThan(0);
  });

  it('keeps one stable order across kinds', () => {
    const ids = channel();
    const sorted = [...ids].sort(
      (a, b) => dm().indexOf(a) - dm().indexOf(b)
    );
    expect(ids.filter((id) => dm().includes(id))).toEqual(
      sorted.filter((id) => dm().includes(id))
    );
  });
});
