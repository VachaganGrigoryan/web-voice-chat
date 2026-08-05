import { describe, expect, it } from 'vitest';
import { matchesConfirmPhrase } from './confirmPhrase';

describe('typed destructive confirmation', () => {
  it('accepts the exact phrase', () => {
    expect(matchesConfirmPhrase('Design Team', 'Design Team')).toBe(true);
  });

  it('is case-sensitive', () => {
    expect(matchesConfirmPhrase('design team', 'Design Team')).toBe(false);
    expect(matchesConfirmPhrase('DESIGN TEAM', 'Design Team')).toBe(false);
  });

  it('rejects a near miss', () => {
    expect(matchesConfirmPhrase('Design Tea', 'Design Team')).toBe(false);
    expect(matchesConfirmPhrase('Design  Team', 'Design Team')).toBe(false);
    expect(matchesConfirmPhrase('', 'Design Team')).toBe(false);
  });

  it('rejects a constant word that is not the resource name', () => {
    // The whole point: "delete" must not confirm a resource called something else.
    expect(matchesConfirmPhrase('delete', 'Design Team')).toBe(false);
  });

  it('forgives surrounding whitespace, which is a paste artefact', () => {
    expect(matchesConfirmPhrase('  Design Team  ', 'Design Team')).toBe(true);
  });

  it('requires nothing when no phrase is expected', () => {
    // Per-viewer actions keep their single-step confirmation.
    expect(matchesConfirmPhrase('', null)).toBe(true);
    expect(matchesConfirmPhrase('', undefined)).toBe(true);
    expect(matchesConfirmPhrase('anything', '')).toBe(true);
  });
});
