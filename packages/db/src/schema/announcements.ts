import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const announcements = sqliteTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    targetRole: text('target_role').default('all'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    targetRoleIdx: index('announcements_target_role_idx').on(t.targetRole),
    activeIdx: index('announcements_active_idx').on(t.isActive),
  }),
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  creator: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
}));
