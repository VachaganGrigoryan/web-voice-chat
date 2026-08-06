import { describe, expect, it } from 'vitest';
import { buildInboxMenuItemIds } from './inboxMenuItems';

const dm = () => buildInboxMenuItemIds({ kind: 'dm', hasConversationOnly: true });
const group = () => buildInboxMenuItemIds({ kind: 'group', hasConversationOnly: true });
const channel = () => buildInboxMenuItemIds({ kind: 'channel', hasConversationOnly: false });

describe('inbox row menu items', () => {
  it('offers pin, archive, notifications and mark-read to every row kind', () => {
    for (const ids of [dm(), group(), channel()]) {
      expect(ids).toContain('pin');
      expect(ids).toContain('archive');
      expect(ids).toContain('notifications');
      expect(ids).toContain('mark_read');
    }
  });

  it('gives a channel archive, which its old branch omitted', () => {
    expect(channel()).toContain('archive');
  });

  it('gives a conversation a notification control, which its old branch omitted', () => {
    expect(dm()).toContain('notifications');
    expect(group()).toContain('notifications');
  });

  it('omits conversation-only items from a channel', () => {
    const ids = channel();
    expect(ids).not.toContain('folder');
    expect(ids).not.toContain('clear');
    expect(ids).not.toContain('delete');
  });

  it('offers leave to a group and a channel but not a direct message', () => {
    expect(group()).toContain('leave');
    expect(channel()).toContain('leave');
    expect(dm()).not.toContain('leave');
  });

  it('keeps one stable order across kinds', () => {
    const order = dm();
    const channelIds = channel();
    const positions = channelIds
      .filter((id) => order.includes(id))
      .map((id) => order.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('never returns an empty menu', () => {
    expect(dm().length).toBeGreaterThan(0);
    expect(group().length).toBeGreaterThan(0);
    expect(channel().length).toBeGreaterThan(0);
  });
});
