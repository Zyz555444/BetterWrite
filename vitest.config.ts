import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, 'apps/web/src') },
      {
        find: '@betterwrite/shared/env',
        replacement: path.resolve(__dirname, 'packages/shared/src/env.ts'),
      },
      {
        find: '@betterwrite/shared/logger',
        replacement: path.resolve(__dirname, 'packages/shared/src/logger.ts'),
      },
      {
        find: '@betterwrite/shared/queue',
        replacement: path.resolve(__dirname, 'packages/shared/src/queue.ts'),
      },
      {
        find: '@betterwrite/shared',
        replacement: path.resolve(__dirname, 'packages/shared/src/index.ts'),
      },
      {
        find: '@betterwrite/db',
        replacement: path.resolve(__dirname, 'packages/db/src/index.ts'),
      },
      {
        find: '@betterwrite/ai',
        replacement: path.resolve(__dirname, 'packages/ai/src/index.ts'),
      },
      {
        find: '@betterwrite/worker',
        replacement: path.resolve(__dirname, 'apps/worker/src/index.ts'),
      },
    ],
  },
  test: {
    env: {
      DATABASE_URL: ':memory:',
      NEXTAUTH_SECRET: 'test-secret-that-is-long-enough-for-validation-32',
      NODE_ENV: 'test',
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
