import { describe, expect, it } from 'vitest';
import {
  MAX_STYLED_POST_LENGTH,
  POST_STYLES,
  canStylePost,
  resolvePostStyle,
} from './postStyles';

describe('post styles', () => {
  it('has no duplicate ids and always includes plain', () => {
    const ids = POST_STYLES.map((style) => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('plain');
  });

  it('degrades an unknown or absent id to plain', () => {
    expect(resolvePostStyle('not-a-style').id).toBe('plain');
    expect(resolvePostStyle(null).id).toBe('plain');
    expect(resolvePostStyle(undefined).id).toBe('plain');
  });

  it('resolves a known id', () => {
    expect(resolvePostStyle('ocean').id).toBe('ocean');
  });

  it('renders plain with no background classes', () => {
    expect(resolvePostStyle('plain').className).toBe('');
  });

  it('allows a background only on a short text-only post', () => {
    expect(canStylePost('hello', 0)).toBe(true);
    expect(canStylePost('hello', 1)).toBe(false);
    expect(canStylePost('   ', 0)).toBe(false);
    expect(canStylePost('a'.repeat(MAX_STYLED_POST_LENGTH), 0)).toBe(true);
    expect(canStylePost('a'.repeat(MAX_STYLED_POST_LENGTH + 1), 0)).toBe(false);
  });
});
