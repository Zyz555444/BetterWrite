import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const essayDrafts = sqliteTable(
  'essay_drafts',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id),
    taskId: text('task_id').notNull(),
    content: text('content').notNull(),
    wordCount: integer('word_count'),
    durationMs: integer('duration_ms'),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    studentTaskIdx: uniqueIndex('essay_drafts_student_task_idx').on(t.studentId, t.taskId),
  }),
);

export const essayDraftsRelations = relations(essayDrafts, ({ one }) => ({
  student: one(users, {
    fields: [essayDrafts.studentId],
    references: [users.id],
  }),
}));
