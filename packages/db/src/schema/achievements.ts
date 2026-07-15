import { relations } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { users } from './users.js';

export const achievements = sqliteTable(
  'achievements',
  {
    id: text('id').primaryKey(),
    studentId: text('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    tier: text('tier').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    icon: text('icon'),
    earnedAt: text('earned_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    studentCodeIdx: uniqueIndex('achievements_student_code_idx').on(t.studentId, t.code),
  }),
);

export const achievementsRelations = relations(achievements, ({ one }) => ({
  student: one(users, {
    fields: [achievements.studentId],
    references: [users.id],
  }),
}));
