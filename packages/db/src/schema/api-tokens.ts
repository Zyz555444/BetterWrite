import { relations } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: text('platform').notNull(),
    deviceName: text('device_name'),
    expiresAt: text('expires_at').notNull(),
    lastUsedAt: text('last_used_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('api_tokens_token_idx').on(t.token),
  }),
);

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));
