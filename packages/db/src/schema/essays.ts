import { relations } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { corrections } from './corrections.js';
import { users } from './users.js';

export const essayTasks = sqliteTable('essay_tasks', {
  id: text('id').primaryKey(),
  classId: text('class_id').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id),
  title: text('title').notNull(),
  topicType: text('topic_type').notNull(),
  topicCategory: text('topic_category'),
  requirements: text('requirements').notNull(),
  keyPoints: text('key_points').default('[]'),
  referenceEssay: text('reference_essay'),
  wordLimitMin: integer('word_limit_min').default(80).notNull(),
  wordLimitMax: integer('word_limit_max').default(125).notNull(),
  timeLimitMinutes: integer('time_limit_minutes').default(15),
  status: text('status').default('draft').notNull(),
  dueDate: text('due_date'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const essays = sqliteTable('essays', {
  id: text('id').primaryKey(),
  taskId: text('task_id'),
  studentId: text('student_id')
    .notNull()
    .references(() => users.id),
  title: text('title'),
  content: text('content').notNull(),
  wordCount: integer('word_count').notNull(),
  submitType: text('submit_type').default('typed').notNull(),
  ocrImageUrl: text('ocr_image_url'),
  ocrConfidence: real('ocr_confidence'),
  handwritingScore: real('handwriting_score'),
  handwritingDetails: text('handwriting_details').default('{}'),
  status: text('status').default('pending').notNull(),
  totalScore: real('total_score'),
  scoreTier: text('score_tier'),
  correctionId: text('correction_id'),
  teacherReview: text('teacher_review'),
  teacherScore: real('teacher_score'),
  submittedAt: text('submitted_at').notNull(),
  correctedAt: text('corrected_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const essayTasksRelations = relations(essayTasks, ({ one }) => ({
  creator: one(users, {
    fields: [essayTasks.createdBy],
    references: [users.id],
  }),
}));

export const essaysRelations = relations(essays, ({ one, many }) => ({
  student: one(users, {
    fields: [essays.studentId],
    references: [users.id],
  }),
  task: one(essayTasks, {
    fields: [essays.taskId],
    references: [essayTasks.id],
  }),
  correction: one(corrections, {
    fields: [essays.correctionId],
    references: [corrections.id],
  }),
  corrections: many(corrections),
}));
