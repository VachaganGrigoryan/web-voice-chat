import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests cover the pure layer only — the standing ladder, capability
 * mapping, realtime predicates and cache writers. Playwright reaches those
 * through the DOM, where a mapping bug surfaces three layers away as a missing
 * composer. A node environment is enough; jsdom is added only when hook tests
 * arrive.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
