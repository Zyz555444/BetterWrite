import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import type { AdminDashboardStats } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import { Activity, BookOpen, School, Users } from 'lucide-react';
import { redirect } from 'next/navigation';

interface DashboardCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  hint?: string;
}

export default async function AdminDashboardPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.SUPER_ADMIN) redirect(getDashboardPath(user.role));

  let stats: AdminDashboardStats | null = null;
  let error: string | null = null;

  try {
    const res = await serverFetcher.getAdminDashboardStats();
    if (res.success && res.data) {
      stats = res.data;
    } else {
      error = res.error ?? '加载失败';
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败';
    logger.error({ err }, '[AdminDashboard] load error');
  }

  const cards: DashboardCard[] = stats
    ? [
        {
          label: '学校总数',
          value: String(stats.totalSchools),
          icon: <School className="w-5 h-5 text-accent" />,
        },
        {
          label: '教师总数',
          value: String(stats.totalTeachers),
          icon: <Users className="w-5 h-5 text-accent" />,
        },
        {
          label: '学生总数',
          value: String(stats.totalStudents),
          icon: <Users className="w-5 h-5 text-accent" />,
          hint: `活跃率 ${stats.activeRate}%`,
        },
        {
          label: '今日作文数',
          value: String(stats.todayEssays),
          icon: <BookOpen className="w-5 h-5 text-accent" />,
          hint: `累计 ${stats.totalEssays} 篇`,
        },
        {
          label: 'API 今日调用',
          value: String(stats.apiCallsToday),
          icon: <Activity className="w-5 h-5 text-accent" />,
        },
        {
          label: 'API 总调用',
          value: String(stats.apiCallsTotal),
          icon: <Activity className="w-5 h-5 text-accent" />,
          hint: `成功率 ${stats.apiSuccessRate}%`,
        },
        {
          label: 'API 平均延迟',
          value: `${stats.apiAvgLatencyMs}ms`,
          icon: <Activity className="w-5 h-5 text-accent" />,
        },
        {
          label: 'API 成功率',
          value: `${stats.apiSuccessRate}%`,
          icon: <Activity className="w-5 h-5 text-accent" />,
        },
      ]
    : [];

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <div className="space-y-6">
        <div>
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">超级管理员控制台</h1>
          <p className="text-copy-14 text-neutral-8 mt-1">系统总览、API 统计与健康监控</p>
        </div>

        {error && (
          <Card>
            <CardContent className="p-4">
              <p className="text-copy-14 text-error">{error}</p>
            </CardContent>
          </Card>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {cards.map((card) => (
                <Card key={card.label}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-copy-14 font-medium text-neutral-8">
                        {card.label}
                      </CardTitle>
                      {card.icon}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-title-28 font-medium text-neutral-10">{card.value}</p>
                    {card.hint && <p className="text-label-12 text-neutral-7 mt-1">{card.hint}</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-title-20">系统状态</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-copy-14 text-neutral-8">服务状态</span>
                  <Badge variant="default">运行中</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-14 text-neutral-8">学生活跃率</span>
                  <span className="text-copy-14 font-medium text-neutral-10">
                    {stats.activeRate}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-14 text-neutral-8">API 调用成功率</span>
                  <Badge variant={stats.apiSuccessRate >= 95 ? 'default' : 'destructive'}>
                    {stats.apiSuccessRate}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-copy-14 text-neutral-8">API 平均延迟</span>
                  <span className="text-copy-14 font-medium text-neutral-10">
                    {stats.apiAvgLatencyMs}ms
                  </span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
