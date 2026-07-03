import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { corrections } from './corrections.js';
import { essays } from './essays.js';
import { users } from './users.js';

export const errorBooks = sqliteTable('error_books', {
  id: text('id').primaryKey(),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  essayId: text('essay_id').references(() => essays.id),
  correctionId: text('correction_id').references(() => corrections.id),
  errorType: text('error_type').notNull(),
  original: text('original').notNull(),
  corrected: text('corrected').notNull(),
  explanation: text('explanation'),
  position: text('position').default('{}'),
  status: text('status').default('unresolved').notNull(),
  practiceCount: integer('practice_count').default(0),
  masteredAt: text('mastered_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const errorBooksRelations = relations(errorBooks, ({ one }) => ({
  student: one(users, {
    fields: [errorBooks.studentId],
    references: [users.id],
  }),
  essay: one(essays, {
    fields: [errorBooks.essayId],
    references: [essays.id],
  }),
  correction: one(corrections, {
    fields: [errorBooks.correctionId],
    references: [corrections.id],
  }),
}));
