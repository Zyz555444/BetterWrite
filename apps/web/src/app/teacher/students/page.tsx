import { DashboardLayout } from '@/components/layout/dashboard-layout';
import type { StudentListItem } from '@/lib/api/fetcher-types';
import { type TeacherClass, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { type AuthUser, getDashboardPath } from '@/lib/auth-store';
import { UserRole } from '@betterwrite/shared';
import { redirect } from 'next/navigation';
import { StudentsClient } from './students-client';

export default async function TeacherStudentsPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.TEACHER) redirect(getDashboardPath(user.role));

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
      console.warn('[TeacherStudents] failed to load classes:', classesRes.value.error);
    }
  } else {
    console.error('[TeacherStudents] loadClasses error:', classesRes.reason);
  }
  if (studentsRes.status === 'fulfilled') {
    if (studentsRes.value.success && studentsRes.value.data) {
      students = studentsRes.value.data;
    } else {
      error = studentsRes.value.error ?? '获取学生失败';
      console.warn('[TeacherStudents] failed to load students:', error);
    }
  } else {
    error = '获取学生失败';
    console.error('[TeacherStudents] loadStudents error:', studentsRes.reason);
  }

  return (
    <DashboardLayout user={user as AuthUser}>
      <StudentsClient initialClasses={classes} initialStudents={students} initialError={error} />
    </DashboardLayout>
  );
}
