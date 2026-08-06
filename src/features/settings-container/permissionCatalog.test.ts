import { describe, expect, it } from 'vitest';
import {
  PERMISSION_CATALOG,
  PERMISSION_GROUPS,
  findPermission,
  isEffectivelyGranted,
  permissionsForScope,
  unknownPermissions,
} from './permissionCatalog';

describe('permissionCatalog', () => {
  it('has no duplicate permission values', () => {
    const values = PERMISSION_CATALOG.map((entry) => entry.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('assigns every entry to a declared group', () => {
    const groupIds = new Set(PERMISSION_GROUPS.map((group) => group.id));
    for (const entry of PERMISSION_CATALOG) {
      expect(groupIds.has(entry.group)).toBe(true);
    }
  });

  it('points every own-scoped entry at an existing any-equivalent', () => {
    const ownScoped = PERMISSION_CATALOG.filter((entry) => entry.ownScoped);
    expect(ownScoped.length).toBeGreaterThan(0);
    for (const entry of ownScoped) {
      expect(entry.anyEquivalent).toBeDefined();
      expect(findPermission(entry.anyEquivalent as string)).toBeDefined();
    }
  });

  it('strips space-only permissions outside a space scope', () => {
    const channelScoped = permissionsForScope('channel');
    const spaceScoped = permissionsForScope('space');

    expect(channelScoped.some((entry) => entry.spaceOnly)).toBe(false);
    expect(spaceScoped.some((entry) => entry.spaceOnly)).toBe(true);
    expect(permissionsForScope('conversation')).toEqual(channelScoped);
  });

  it('reports permissions outside the vocabulary so they survive a save', () => {
    expect(unknownPermissions(['resource.view', 'future.permission'])).toEqual([
      'future.permission',
    ]);
    expect(unknownPermissions(['resource.view'])).toEqual([]);
  });

  it('treats an any-permission as satisfying its own-scoped sibling', () => {
    expect(isEffectivelyGranted(['message.delete.any'], 'message.delete.own')).toBe(true);
    expect(isEffectivelyGranted(['message.delete.own'], 'message.delete.any')).toBe(false);
    expect(isEffectivelyGranted([], 'message.delete.own')).toBe(false);
    expect(isEffectivelyGranted(['message.read'], 'message.read')).toBe(true);
  });
});
