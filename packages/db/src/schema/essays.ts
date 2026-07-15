import { relations } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { classes } from './classes.js';
import { corrections } from './corrections.js';
import { errorBooks } from './error-books.js';
import { users } from './users.js';

export const essayTasks = sqliteTable(
  'essay_tasks',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  },
  (t) => ({
    classIdx: index('essay_tasks_class_idx').on(t.classId),
    statusIdx: index('essay_tasks_status_idx').on(t.status),
  }),
);

export const essays = sqliteTable(
  'essays',
  {
    id: text('id').primaryKey(),
    taskId: text('task_id').references(() => essayTasks.id, { onDelete: 'set null' }),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    // correctionId 不在列级声明 .references()：corrections.essayId 已建立
    // essays ↔ corrections 的外键（cascade），双向列级引用会造成 TS 类型循环推断。
    // 关系仍通过下方 essaysRelations 维护，供 Drizzle 查询构建器使用。
    correctionId: text('correction_id'),
    teacherReview: text('teacher_review'),
    teacherScore: real('teacher_score'),
    submittedAt: text('submitted_at').notNull(),
    correctedAt: text('corrected_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    studentIdx: index('essays_student_idx').on(t.studentId),
    taskIdx: index('essays_task_idx').on(t.taskId),
    statusIdx: index('essays_status_idx').on(t.status),
    scoreTierIdx: index('essays_score_tier_idx').on(t.scoreTier),
  }),
);

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
  errorBooks: many(errorBooks),
}));
