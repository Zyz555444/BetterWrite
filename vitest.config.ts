import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'apps/web/src'),
      '@betterwrite/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@betterwrite/db': path.resolve(__dirname, 'packages/db/src/index.ts'),
      '@betterwrite/ai': path.resolve(__dirname, 'packages/ai/src/index.ts'),
      '@betterwrite/worker': path.resolve(__dirname, 'apps/worker/src/index.ts'),
    },
  },
  test: {
    env: {
      DATABASE_URL: ':memory:',
    },
    include: [
      'packages/shared/src/**/*.test.ts',
      'packages/ai/src/**/*.test.ts',
      'apps/web/src/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['packages/shared/src/**/*.ts', 'packages/ai/src/**/*.ts'],
      exclude: ['**/index.ts', '**/*.d.ts', '**/__tests__/**'],
    },
  },
});
