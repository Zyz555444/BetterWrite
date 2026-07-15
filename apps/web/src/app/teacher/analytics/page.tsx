import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { type TeacherClass, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import type { ClassAnalytics } from '@betterwrite/shared';
import { UserRole, type UserRoleType } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import { redirect } from 'next/navigation';
import { AnalyticsClient } from './analytics-client';

export default async function TeacherAnalyticsPage() {
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
  let analytics: ClassAnalytics | null = null;
  let error: string | null = null;

  try {
    const classesRes = await serverFetcher.listTeacherClasses();
    if (classesRes.success && classesRes.data) {
      classes = classesRes.data;
      if (classes.length > 0) {
        const firstId = classes[0].id;
        try {
          const analyticsRes = await serverFetcher.getClassAnalytics(firstId);
          if (analyticsRes.success && analyticsRes.data) {
            analytics = analyticsRes.data;
          } else {
            logger.warn(
              { error: analyticsRes.error },
              '[TeacherAnalytics] getClassAnalytics failed',
            );
          }
        } catch (err) {
          logger.error({ err }, '[TeacherAnalytics] getClassAnalytics error');
        }
      }
    } else {
      logger.warn({ error: classesRes.error }, '[TeacherAnalytics] listTeacherClasses failed');
      error = classesRes.error ?? '获取班级列表失败';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载失败';
    logger.error({ message }, '[TeacherAnalytics] listTeacherClasses error');
    error = message;
  }

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <AnalyticsClient
        initialClasses={classes}
        initialAnalytics={analytics}
        initialClassId={classes[0]?.id ?? ''}
        initialError={error}
      />
    </DashboardLayout>
  );
}
