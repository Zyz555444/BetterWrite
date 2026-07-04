import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'file:local.db',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
