import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { questionBank } from './question-bank.js';
import { users } from './users.js';

export const practiceExercises = sqliteTable(
  'practice_exercises',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    exerciseType: text('exercise_type').notNull(),
    questionId: text('question_id').references(() => questionBank.id, { onDelete: 'set null' }),
    topicType: text('topic_type'),
    title: text('title'),
    content: text('content').notNull(),
    wordCount: integer('word_count'),
    score: real('score'),
    scoreTier: text('score_tier'),
    aiFeedback: text('ai_feedback').default('{}'),
    durationMs: integer('duration_ms'),
    status: text('status').default('completed').notNull(),
    startedAt: text('started_at'),
    submittedAt: text('submitted_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    studentIdx: index('practice_exercises_student_idx').on(t.studentId),
  }),
);

export const practiceExercisesRelations = relations(practiceExercises, ({ one }) => ({
  student: one(users, {
    fields: [practiceExercises.studentId],
    references: [users.id],
  }),
  question: one(questionBank, {
    fields: [practiceExercises.questionId],
    references: [questionBank.id],
  }),
}));
