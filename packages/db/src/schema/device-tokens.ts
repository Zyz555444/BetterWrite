import { relations } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const deviceTokens = sqliteTable(
  'device_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    token: text('token').notNull(),
    platform: text('platform').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    userTokenIdx: uniqueIndex('device_tokens_user_token_idx').on(t.userId, t.token),
  }),
);

export const deviceTokensRelations = relations(deviceTokens, ({ one }) => ({
  user: one(users, {
    fields: [deviceTokens.userId],
    references: [users.id],
  }),
}));
