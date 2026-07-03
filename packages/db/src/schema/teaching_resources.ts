import { relations } from 'drizzle-orm';
import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const teachingResources = sqliteTable(
  'teaching_resources',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    topicType: text('topic_type'),
    difficulty: text('difficulty').notNull().default('medium'),
    content: text('content').notNull(),
    highlights: text('highlights').default(''),
    tags: text('tags').default('[]'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    creatorIdx: index('teaching_resources_creator_idx').on(t.createdBy),
    typeIdx: index('teaching_resources_type_idx').on(t.type),
  }),
);

export const teachingResourcesRelations = relations(teachingResources, ({ one }) => ({
  creator: one(users, {
    fields: [teachingResources.createdBy],
    references: [users.id],
  }),
}));
