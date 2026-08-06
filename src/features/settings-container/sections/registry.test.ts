import { describe, expect, it } from 'vitest';
import {
  SETTINGS_SECTIONS,
  type SectionCapabilityView,
  type SettingsSubjectKind,
  resolveActiveSection,
  resolveSections,
} from './registry';

const NONE: SectionCapabilityView = {
  canManage: false,
  canManageMembers: false,
  canManageRoles: false,
  canInvite: false,
  canApproveJoins: false,
};

const ALL: SectionCapabilityView = {
  canManage: true,
  canManageMembers: true,
  canManageRoles: true,
  canInvite: true,
  canApproveJoins: true,
};

const idsFor = (kind: SettingsSubjectKind, capabilities: SectionCapabilityView) =>
  resolveSections(kind, capabilities).map((section) => section.id);

describe('settings section registry', () => {
  it('has no duplicate section ids', () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('applies every section to at least one kind', () => {
    for (const section of SETTINGS_SECTIONS) {
      expect(section.kinds.length).toBeGreaterThan(0);
    }
  });

  it('gives a direct message only the sections that apply to it', () => {
    expect(idsFor('dm', ALL)).toEqual(['general', 'notifications', 'danger']);
  });

  it('omits sections the viewer lacks the capability for', () => {
    expect(idsFor('channel', NONE)).toEqual(['general', 'notifications', 'danger']);
    expect(idsFor('channel', ALL)).toEqual([
      'general',
      'notifications',
      'access',
      'members',
      'roles',
      'danger',
    ]);
  });

  it('renders members but not roles when only member management is granted', () => {
    const ids = idsFor('group', { ...NONE, canManageMembers: true });
    expect(ids).toContain('members');
    expect(ids).not.toContain('roles');
  });

  it('omits sections whose endpoints do not exist for a kind', () => {
    // No conversation policy update endpoint.
    expect(idsFor('group', ALL)).not.toContain('access');
    // No channel invite-link or join-request routes.
    expect(idsFor('channel', ALL)).not.toContain('invites');
    expect(idsFor('channel', ALL)).not.toContain('requests');
    // A space is not a container, so it has no personal inbox state.
    expect(idsFor('space', ALL)).not.toContain('notifications');
  });

  it('offers the danger section to a space, which can now be deleted', () => {
    expect(idsFor('space', ALL)).toContain('danger');
  });

  it('resolves a requested section and falls back to the first visible one', () => {
    const visible = resolveSections('channel', ALL);
    expect(resolveActiveSection('roles', visible)?.id).toBe('roles');
    expect(resolveActiveSection('invites', visible)?.id).toBe('general');
    expect(resolveActiveSection(undefined, visible)?.id).toBe('general');
    expect(resolveActiveSection('general', [])).toBeNull();
  });
});
