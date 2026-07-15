import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { achievements } from './achievements.js';
import { aiConversations } from './ai-conversations.js';
import { apiTokens } from './api-tokens.js';
import { deviceTokens } from './device-tokens.js';
import { errorBooks } from './error-books.js';
import { essayDrafts } from './essay-drafts.js';
import { practiceExercises } from './practice-exercises.js';
import { schools } from './schools.js';
import { studentTags } from './student_tags.js';
import { teachingResources } from './teaching_resources.js';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull(),
    schoolId: text('school_id').references(() => schools.id, { onDelete: 'set null' }),
    studentNo: text('student_no'),
    avatarUrl: text('avatar_url'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    lastLoginAt: text('last_login_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    schoolIdx: index('users_school_idx').on(t.schoolId),
    roleIdx: index('users_role_idx').on(t.role),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
  teachingResources: many(teachingResources),
  studentTags: many(studentTags),
  errorBooks: many(errorBooks),
  practiceExercises: many(practiceExercises),
  aiConversations: many(aiConversations),
  achievements: many(achievements),
  essayDrafts: many(essayDrafts),
  apiTokens: many(apiTokens),
  deviceTokens: many(deviceTokens),
}));
