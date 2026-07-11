import { BarChart } from '@/components/charts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DailyQuote } from '@/components/student';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Essay, EssayTask } from '@/lib/api/fetcher-types';
import { type StudentDashboardData, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import type { DailyQuote as DailyQuoteData } from '@betterwrite/shared';
import { UserRole, calculateScoreDistribution, formatScore } from '@betterwrite/shared';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function StudentDashboardPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.STUDENT) redirect(getDashboardPath(user.role));

  let dashboard: StudentDashboardData | null = null;
  let tasks: EssayTask[] = [];
  let essays: Essay[] = [];
  let error: string | null = null;

  const [dashboardRes, tasksRes, essaysRes] = await Promise.allSettled([
    serverFetcher.getStudentDashboard(),
    serverFetcher.listTasks(),
    serverFetcher.listMyEssays(),
  ]);

  const errors: string[] = [];
  if (dashboardRes.status === 'fulfilled') {
    if (dashboardRes.value.success && dashboardRes.value.data) {
      dashboard = dashboardRes.value.data;
    } else {
      errors.push(dashboardRes.value.error ?? '仪表盘加载失败');
    }
  } else {
    errors.push(
      dashboardRes.reason instanceof Error ? dashboardRes.reason.message : '仪表盘加载失败',
    );
  }
  if (tasksRes.status === 'fulfilled') {
    if (tasksRes.value.success && tasksRes.value.data) {
      tasks = tasksRes.value.data;
    } else {
      errors.push('任务列表加载失败');
    }
  } else {
    errors.push('任务列表加载失败');
  }
  if (essaysRes.status === 'fulfilled') {
    if (essaysRes.value.success && essaysRes.value.data) {
      essays = essaysRes.value.data;
    } else {
      errors.push('作文列表加载失败');
    }
  } else {
    errors.push('作文列表加载失败');
  }
  if (errors.length > 0) error = errors.join('；');

  const pendingTasks = dashboard?.pendingTasks ?? 0;
  const correctedEssays = dashboard?.correctedEssays ?? 0;
  const averageScore = dashboard?.averageScore ?? null;
  const quote: DailyQuoteData | null = dashboard?.quote ?? null;

  const scoreDistData = calculateScoreDistribution(
    essays
      .filter((e) => e.status === 'completed')
      .map((e) => e.totalScore)
      .filter((s): s is number => s !== null),
  ).map((item) => ({ label: item.range, value: item.count }));

  const stats = [
    { label: '待完成任务', value: pendingTasks.toString() },
    { label: '已批改作文', value: correctedEssays.toString() },
    { label: '平均得分', value: formatScore(averageScore) },
  ];

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <div className="space-y-6">
        {error && (
          <div className="rounded-md ring-1 ring-error/30 bg-error/10 p-3 text-copy-14 text-error">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between">
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">学习首页</h1>
          <Link href="/student/tasks">
            <Button>去写作文</Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-copy-14 font-medium text-neutral-8">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-title-28 font-medium text-neutral-10">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <DailyQuote quote={quote} />

        <Card>
          <CardHeader>
            <CardTitle className="text-title-20">成绩分布</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={scoreDistData} height={220} color="var(--accent)" />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">最近任务</CardTitle>
            </CardHeader>
            <CardContent>
              {tasks.slice(0, 3).length === 0 ? (
                <p className="text-neutral-8 text-copy-14">暂无任务</p>
              ) : (
                <ul className="space-y-3">
                  {tasks.slice(0, 3).map((task) => (
                    <li key={task.id} className="flex items-center justify-between">
                      <span className="text-neutral-10 text-copy-14 truncate">{task.title}</span>
                      <Link href={`/student/tasks/${task.id}/write`}>
                        <Button variant="ghost" size="sm">
                          写作
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">最近批改</CardTitle>
            </CardHeader>
            <CardContent>
              {essays.filter((e) => e.status === 'completed').slice(0, 3).length === 0 ? (
                <p className="text-neutral-8 text-copy-14">暂无批改结果</p>
              ) : (
                <ul className="space-y-3">
                  {essays
                    .filter((e) => e.status === 'completed')
                    .slice(0, 3)
                    .map((essay) => (
                      <li key={essay.id} className="flex items-center justify-between">
                        <span className="text-neutral-10 text-copy-14 truncate">
                          {essay.title ?? essay.task?.title ?? '未命名作文'}
                        </span>
                        <Link href={`/student/essays/${essay.id}`}>
                          <Button variant="ghost" size="sm">
                            {formatScore(essay.totalScore)} 分
                          </Button>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
