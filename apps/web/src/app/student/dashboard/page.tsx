'use client';

import { BarChart } from '@/components/charts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { DailyQuote } from '@/components/student';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Essay, type EssayTask, fetcher } from '@/lib/api/fetcher';
import type { DailyQuote as DailyQuoteData } from '@betterwrite/shared';
import { UserRole, calculateScoreDistribution, formatScore } from '@betterwrite/shared';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface DashboardData {
  pendingTasks: number;
  correctedEssays: number;
  averageScore: number | null;
  quote: DailyQuoteData | null;
}

export default function StudentDashboardPage() {
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[StudentDashboard] loading dashboard, tasks, essays');
    Promise.allSettled([fetcher.getStudentDashboard(), fetcher.listTasks(), fetcher.listMyEssays()])
      .then(([dashboardRes, tasksRes, essaysRes]) => {
        const errors: string[] = [];
        if (
          dashboardRes.status === 'fulfilled' &&
          dashboardRes.value.success &&
          dashboardRes.value.data
        ) {
          setDashboard(dashboardRes.value.data);
          console.log(
            `[StudentDashboard] dashboard loaded pendingTasks=${dashboardRes.value.data.pendingTasks} correctedEssays=${dashboardRes.value.data.correctedEssays} hasQuote=${dashboardRes.value.data.quote ? 'true' : 'false'}`,
          );
        } else if (dashboardRes.status === 'rejected') {
          errors.push(
            dashboardRes.reason instanceof Error ? dashboardRes.reason.message : '仪表盘加载失败',
          );
        }
        if (tasksRes.status === 'fulfilled' && tasksRes.value.success && tasksRes.value.data) {
          setTasks(tasksRes.value.data);
        } else if (tasksRes.status === 'rejected') {
          errors.push('任务列表加载失败');
        }
        if (essaysRes.status === 'fulfilled' && essaysRes.value.success && essaysRes.value.data) {
          setEssays(essaysRes.value.data);
        } else if (essaysRes.status === 'rejected') {
          errors.push('作文列表加载失败');
        }
        if (errors.length > 0) setError(errors.join('；'));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const scoreDistData = useMemo(
    () =>
      calculateScoreDistribution(
        essays
          .filter((e) => e.status === 'completed')
          .map((e) => e.totalScore)
          .filter((s): s is number => s !== null),
      ).map((item) => ({ label: item.range, value: item.count })),
    [essays],
  );

  const pendingTasks = dashboard?.pendingTasks ?? 0;
  const correctedEssays = dashboard?.correctedEssays ?? 0;
  const averageScore = dashboard?.averageScore ?? null;

  const stats = [
    { label: '待完成任务', value: isLoading ? '-' : pendingTasks.toString() },
    { label: '已批改作文', value: isLoading ? '-' : correctedEssays.toString() },
    { label: '平均得分', value: isLoading ? '-' : formatScore(averageScore) },
  ];

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
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

          <DailyQuote quote={dashboard?.quote ?? null} />

          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">成绩分布</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-neutral-8 text-copy-14">加载中...</p>
              ) : (
                <BarChart data={scoreDistData} height={220} color="var(--accent)" />
              )}
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
    </RoleGuard>
  );
}
