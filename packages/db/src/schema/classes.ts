import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { schools } from './schools.js';
import { users } from './users.js';

export const classes = sqliteTable(
  'classes',
  {
    id: text('id').primaryKey(),
    schoolId: text('school_id')
      .notNull()
      .references(() => schools.id),
    code: text('code').notNull().default(''),
    name: text('name').notNull(),
    grade: text('grade').notNull(),
    teacherId: text('teacher_id').references(() => users.id),
    academicYear: text('academic_year'),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => ({
    schoolIdx: index('classes_school_idx').on(t.schoolId),
    teacherIdx: index('classes_teacher_idx').on(t.teacherId),
  }),
);

export const classEnrollments = sqliteTable(
  'class_enrollments',
  {
    id: text('id').primaryKey(),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').default('student').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => ({
    classIdx: index('class_enrollments_class_idx').on(t.classId),
    userIdx: index('class_enrollments_user_idx').on(t.userId),
    roleIdx: index('class_enrollments_role_idx').on(t.role),
  }),
);

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  teacher: one(users, {
    fields: [classes.teacherId],
    references: [users.id],
  }),
  enrollments: many(classEnrollments),
}));

export const classEnrollmentsRelations = relations(classEnrollments, ({ one }) => ({
  class: one(classes, {
    fields: [classEnrollments.classId],
    references: [classes.id],
  }),
  user: one(users, {
    fields: [classEnrollments.userId],
    references: [users.id],
  }),
}));
