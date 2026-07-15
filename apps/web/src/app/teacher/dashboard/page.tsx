import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type TeacherDashboardData, serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import { UserRole, type UserRoleType, formatScore, getEssayStatusLabel } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  FileText,
  PenLine,
  Plus,
  School,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  correcting: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-error/10 text-error',
};

export default async function TeacherDashboardPage() {
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

  let data: TeacherDashboardData | null = null;
  let error: string | null = null;

  try {
    const res = await serverFetcher.getTeacherDashboard();
    if (res.success && res.data) {
      data = res.data;
    } else {
      error = res.error ?? '加载失败';
      logger.warn({ error }, '[TeacherDashboard] load failed');
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败';
    logger.error({ err }, '[TeacherDashboard] load error');
  }

  const stats = data
    ? [
        {
          label: '任教班级',
          value: String(data.stats.totalClasses),
          icon: <School className="w-4 h-4" />,
        },
        {
          label: '学生总数',
          value: String(data.stats.totalStudents),
          icon: <Users className="w-4 h-4" />,
        },
        {
          label: '待批改作文',
          value: String(data.stats.pendingEssays),
          icon: <FileText className="w-4 h-4" />,
        },
        {
          label: '平均得分',
          value: formatScore(data.stats.averageScore),
          icon: <BarChart3 className="w-4 h-4" />,
        },
      ]
    : [];

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">班级概览</h1>
            <p className="text-copy-14 text-neutral-8 mt-1">查看班级动态、任务与作文批改情况</p>
          </div>
          <Link href="/teacher/tasks">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              布置任务
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-copy-14 font-medium text-neutral-8">
                  {stat.label}
                </CardTitle>
                <span className="text-neutral-7">{stat.icon}</span>
              </CardHeader>
              <CardContent>
                <p className="text-title-28 font-medium text-neutral-10">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {error && <p className="text-error text-copy-14">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-title-20 flex items-center gap-2">
                <School className="w-4 h-4 text-accent" />
                我的班级
              </CardTitle>
              <Link href="/teacher/students">
                <Button variant="ghost" size="sm">
                  学生管理
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex-1">
              {!data || data.classes.length === 0 ? (
                <p className="text-neutral-8 text-copy-14">暂无任教班级</p>
              ) : (
                <ul className="space-y-3">
                  {data.classes.map((cls) => (
                    <li
                      key={cls.id}
                      className="flex items-center justify-between p-3 bg-neutral-2 rounded-md"
                    >
                      <div>
                        <p className="font-medium text-neutral-10">
                          {cls.grade} · {cls.name}
                        </p>
                        <p className="text-label-12 text-neutral-8 mt-0.5">
                          {cls.studentCount} 名学生
                        </p>
                      </div>
                      <Users className="w-4 h-4 text-neutral-7" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-title-20 flex items-center gap-2">
                <PenLine className="w-4 h-4 text-accent" />
                最近任务
              </CardTitle>
              <Link href="/teacher/tasks">
                <Button variant="ghost" size="sm">
                  全部任务
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="flex-1">
              {!data || data.recentTasks.length === 0 ? (
                <p className="text-neutral-8 text-copy-14">暂无任务，点击右上角布置第一篇作文</p>
              ) : (
                <ul className="space-y-3">
                  {data.recentTasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between p-3 bg-neutral-2 rounded-md"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-10 truncate">{task.title}</p>
                        <p className="text-label-12 text-neutral-8 mt-0.5">
                          {task.topicType} · {task.wordLimitMin}-{task.wordLimitMax} 词
                        </p>
                      </div>
                      <BookOpen className="w-4 h-4 text-neutral-7 shrink-0 ml-2" />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-title-20 flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              最近作文
            </CardTitle>
            <Link href="/teacher/essays">
              <Button variant="ghost" size="sm">
                批改中心
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!data || data.recentEssays.length === 0 ? (
              <p className="text-neutral-8 text-copy-14">暂无学生提交作文</p>
            ) : (
              <ul className="space-y-3">
                {data.recentEssays.map((essay) => (
                  <li
                    key={essay.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-neutral-2 rounded-md"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-neutral-10 truncate">
                        {essay.title ?? essay.task?.title ?? '未命名作文'}
                      </p>
                      <p className="text-label-12 text-neutral-8 mt-0.5">
                        {essay.student?.name ?? '未知学生'}
                        {essay.student?.studentNo ? ` (${essay.student.studentNo})` : ''} ·{' '}
                        {essay.wordCount} 词 · {new Date(essay.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-label-12 px-2 py-0.5 rounded-full ${statusColors[essay.status] ?? 'bg-neutral-3 text-neutral-8'}`}
                      >
                        {getEssayStatusLabel(essay.status)}
                      </span>
                      {essay.status === 'completed' && (
                        <span className="text-copy-14 font-medium text-neutral-10">
                          {formatScore(essay.totalScore)} 分
                        </span>
                      )}
                      <Link href={`/teacher/essays/${essay.id}`}>
                        <Button variant="ghost" size="sm">
                          查看
                        </Button>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
