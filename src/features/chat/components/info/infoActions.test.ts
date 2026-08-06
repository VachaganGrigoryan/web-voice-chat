import { describe, expect, it } from 'vitest';
import { buildInfoActionIds, type InfoActionInput } from './infoActions';

const build = (overrides: Partial<InfoActionInput>) =>
  buildInfoActionIds({
    kind: 'dm',
    canManage: false,
    hasSurface: true,
    hasPeer: true,
    ...overrides,
  });

describe('container info actions', () => {
  it('gives a direct message its peer actions', () => {
    expect(build({ kind: 'dm' })).toEqual(['open_surface', 'follow', 'block']);
  });

  it('does not offer leave on a direct message', () => {
    // A DM is deleted from settings, not left from the summary.
    expect(build({ kind: 'dm' })).not.toContain('leave');
  });

  it('offers a group only what a group has', () => {
    // No page of its own, and a group is joined rather than followed.
    const ids = build({ kind: 'group', hasSurface: false, hasPeer: false });
    expect(ids).toEqual(['leave']);
  });

  it('offers a channel its surface, follow and leave', () => {
    const ids = build({ kind: 'channel', hasPeer: false });
    expect(ids).toEqual(['open_surface', 'follow', 'leave']);
  });

  it('omits settings unless the viewer may manage', () => {
    expect(build({ kind: 'channel', hasPeer: false })).not.toContain('settings');
    expect(build({ kind: 'channel', hasPeer: false, canManage: true })).toContain('settings');
  });

  it('omits the surface action when there is nothing to open', () => {
    expect(build({ hasSurface: false })).not.toContain('open_surface');
  });

  it('omits peer actions when no peer resolves', () => {
    const ids = build({ kind: 'dm', hasPeer: false });
    expect(ids).not.toContain('follow');
    expect(ids).not.toContain('block');
  });

  it('keeps one stable order across kinds', () => {
    const dm = build({ kind: 'dm', canManage: true });
    const channel = build({ kind: 'channel', hasPeer: false, canManage: true });
    const positions = channel.filter((id) => dm.includes(id)).map((id) => dm.indexOf(id));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});
