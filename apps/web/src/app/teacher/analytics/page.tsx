import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { type TeacherClass, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { type AuthUser, getDashboardPath } from '@/lib/auth-store';
import type { ClassAnalytics } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { redirect } from 'next/navigation';
import { AnalyticsClient } from './analytics-client';

export default async function TeacherAnalyticsPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.TEACHER) redirect(getDashboardPath(user.role));

  let classes: TeacherClass[] = [];
  let analytics: ClassAnalytics | null = null;
  let error: string | null = null;

  console.log('[TeacherAnalytics] loading classes');
  try {
    const classesRes = await serverFetcher.listTeacherClasses();
    if (classesRes.success && classesRes.data) {
      classes = classesRes.data;
      console.log(`[TeacherAnalytics] classes loaded count=${classes.length}`);
      if (classes.length > 0) {
        const firstId = classes[0].id;
        console.log(`[TeacherAnalytics] auto-selected first class id=${firstId}`);
        try {
          const analyticsRes = await serverFetcher.getClassAnalytics(firstId);
          if (analyticsRes.success && analyticsRes.data) {
            analytics = analyticsRes.data;
            console.log(
              `[TeacherAnalytics] analytics loaded essays=${analytics.totalEssays} students=${analytics.totalStudents}`,
            );
          } else {
            console.warn('[TeacherAnalytics] getClassAnalytics failed:', analyticsRes.error);
          }
        } catch (err) {
          console.error(
            '[TeacherAnalytics] getClassAnalytics error:',
            err instanceof Error ? err.message : 'unknown',
          );
        }
      }
    } else {
      console.warn('[TeacherAnalytics] listTeacherClasses failed:', classesRes.error);
      error = classesRes.error ?? '获取班级列表失败';
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '加载失败';
    console.error('[TeacherAnalytics] listTeacherClasses error:', message);
    error = message;
  }

  return (
    <DashboardLayout user={user as AuthUser}>
      <AnalyticsClient
        initialClasses={classes}
        initialAnalytics={analytics}
        initialClassId={classes[0]?.id ?? ''}
        initialError={error}
      />
    </DashboardLayout>
  );
}
