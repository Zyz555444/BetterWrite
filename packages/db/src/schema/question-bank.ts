import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { practiceExercises } from './practice-exercises.js';

export const questionBank = sqliteTable('question_bank', {
  id: text('id').primaryKey(),
  topicType: text('topic_type').notNull(),
  topicCategory: text('topic_category'),
  title: text('title').notNull(),
  requirements: text('requirements').notNull(),
  keyPoints: text('key_points').default('[]'),
  referenceEssay: text('reference_essay'),
  wordLimitMin: integer('word_limit_min').default(80).notNull(),
  wordLimitMax: integer('word_limit_max').default(125).notNull(),
  timeLimitMinutes: integer('time_limit_minutes').default(15),
  difficulty: text('difficulty').default('medium'),
  source: text('source'),
  isPublic: integer('is_public').default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const questionBankRelations = relations(questionBank, ({ many }) => ({
  practiceExercises: many(practiceExercises),
}));
