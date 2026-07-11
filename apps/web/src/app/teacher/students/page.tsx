import { DashboardLayout } from '@/components/layout/dashboard-layout';
import type { StudentListItem } from '@/lib/api/fetcher-types';
import { type TeacherClass, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import { UserRole, type UserRoleType } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import { redirect } from 'next/navigation';
import { StudentsClient } from './students-client';

export default async function TeacherStudentsPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const allowedRoles = new Set<UserRoleType>([
    UserRole.TEACHER,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPER_ADMIN,
  ]);
  if (!allowedRoles.has(user.role)) {
    redirect(getDashboardPath(user.role));
  }

  let classes: TeacherClass[] = [];
  let students: StudentListItem[] = [];
  let error: string | null = null;

  const [classesRes, studentsRes] = await Promise.allSettled([
    serverFetcher.listTeacherClasses(),
    serverFetcher.listStudents(),
  ]);

  if (classesRes.status === 'fulfilled') {
    if (classesRes.value.success && classesRes.value.data) {
      classes = classesRes.value.data;
    } else {
      logger.warn({ error: classesRes.value.error }, '[TeacherStudents] failed to load classes');
    }
  } else {
    logger.error(
      { err: classesRes.reason instanceof Error ? classesRes.reason.message : classesRes.reason },
      '[TeacherStudents] loadClasses error',
    );
  }
  if (studentsRes.status === 'fulfilled') {
    if (studentsRes.value.success && studentsRes.value.data) {
      students = studentsRes.value.data;
    } else {
      error = studentsRes.value.error ?? '获取学生失败';
      logger.warn({ error }, '[TeacherStudents] failed to load students');
    }
  } else {
    error = '获取学生失败';
    logger.error(
      {
        err: studentsRes.reason instanceof Error ? studentsRes.reason.message : studentsRes.reason,
      },
      '[TeacherStudents] loadStudents error',
    );
  }

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <StudentsClient initialClasses={classes} initialStudents={students} initialError={error} />
    </DashboardLayout>
  );
}
