'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Essay, type EssayTask, fetcher } from '@/lib/api/fetcher';
import { UserRole } from '@betterwrite/shared';
import { formatScore } from '@betterwrite/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StudentDashboardPage() {
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetcher.listTasks(), fetcher.listMyEssays()])
      .then(([tasksRes, essaysRes]) => {
        if (tasksRes.success && tasksRes.data) setTasks(tasksRes.data);
        if (essaysRes.success && essaysRes.data) setEssays(essaysRes.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const pendingTasks = tasks.filter((t) => t.status === 'published').length;
  const correctedEssays = essays.filter((e) => e.status === 'completed').length;
  const averageScore =
    correctedEssays > 0
      ? essays
          .filter((e) => e.totalScore !== null)
          .reduce((sum, e) => sum + (e.totalScore ?? 0), 0) / correctedEssays
      : null;

  const stats = [
    { label: '待完成任务', value: isLoading ? '-' : pendingTasks.toString() },
    { label: '已批改作文', value: isLoading ? '-' : correctedEssays.toString() },
    { label: '平均得分', value: isLoading ? '-' : formatScore(averageScore) },
  ];

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-serif font-bold text-text-primary">学习首页</h1>
            <Link href="/student/tasks">
              <Button>去写作文</Button>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {stat.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">最近任务</CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.slice(0, 3).length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无任务</p>
                ) : (
                  <ul className="space-y-3">
                    {tasks.slice(0, 3).map((task) => (
                      <li key={task.id} className="flex items-center justify-between">
                        <span className="text-text-primary text-sm truncate">{task.title}</span>
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
                <CardTitle className="text-base">最近批改</CardTitle>
              </CardHeader>
              <CardContent>
                {essays.filter((e) => e.status === 'completed').slice(0, 3).length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无批改结果</p>
                ) : (
                  <ul className="space-y-3">
                    {essays
                      .filter((e) => e.status === 'completed')
                      .slice(0, 3)
                      .map((essay) => (
                        <li key={essay.id} className="flex items-center justify-between">
                          <span className="text-text-primary text-sm truncate">
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
