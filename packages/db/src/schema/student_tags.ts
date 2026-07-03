import { relations } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const studentTags = sqliteTable('student_tags', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  tag: text('tag').notNull(),
  updatedBy: text('updated_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  updatedAt: text('updated_at').notNull(),
});

export const studentTagsRelations = relations(studentTags, ({ one }) => ({
  student: one(users, {
    fields: [studentTags.studentId],
    references: [users.id],
  }),
  updatedByUser: one(users, {
    fields: [studentTags.updatedBy],
    references: [users.id],
  }),
}));
