'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Essay, type EssayTask, fetcher } from '@/lib/api/fetcher';
import { formatScore } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
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
import { useEffect, useState } from 'react';

interface TeacherDashboardData {
  stats: {
    totalClasses: number;
    totalStudents: number;
    pendingEssays: number;
    averageScore: number | null;
  };
  classes: Array<{ id: string; name: string; grade: string; studentCount: number }>;
  recentTasks: EssayTask[];
  recentEssays: Essay[];
}

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  correcting: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-error/10 text-error',
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .getTeacherDashboard()
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error ?? '加载失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setIsLoading(false));
  }, []);

  const stats = [
    {
      label: '任教班级',
      value: isLoading ? '-' : (data?.stats.totalClasses ?? 0),
      icon: <School className="w-4 h-4" />,
    },
    {
      label: '学生总数',
      value: isLoading ? '-' : (data?.stats.totalStudents ?? 0),
      icon: <Users className="w-4 h-4" />,
    },
    {
      label: '待批改作文',
      value: isLoading ? '-' : (data?.stats.pendingEssays ?? 0),
      icon: <FileText className="w-4 h-4" />,
    },
    {
      label: '平均得分',
      value: isLoading ? '-' : formatScore(data?.stats.averageScore ?? null),
      icon: <BarChart3 className="w-4 h-4" />,
    },
  ];

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">班级概览</h1>
              <p className="text-sm text-text-secondary mt-1">查看班级动态、任务与作文批改情况</p>
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
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {stat.label}
                  </CardTitle>
                  <span className="text-text-tertiary">{stat.icon}</span>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
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
                {isLoading ? (
                  <p className="text-text-secondary text-sm">加载中...</p>
                ) : data?.classes.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无任教班级</p>
                ) : (
                  <ul className="space-y-3">
                    {data?.classes.map((cls) => (
                      <li
                        key={cls.id}
                        className="flex items-center justify-between p-3 bg-bg-secondary rounded-md"
                      >
                        <div>
                          <p className="font-medium text-text-primary">
                            {cls.grade} · {cls.name}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {cls.studentCount} 名学生
                          </p>
                        </div>
                        <Users className="w-4 h-4 text-text-tertiary" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
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
                {isLoading ? (
                  <p className="text-text-secondary text-sm">加载中...</p>
                ) : data?.recentTasks.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无任务，点击右上角布置第一篇作文</p>
                ) : (
                  <ul className="space-y-3">
                    {data?.recentTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center justify-between p-3 bg-bg-secondary rounded-md"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">{task.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5">
                            {task.topicType} · {task.wordLimitMin}-{task.wordLimitMax} 词
                          </p>
                        </div>
                        <BookOpen className="w-4 h-4 text-text-tertiary shrink-0 ml-2" />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
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
              {isLoading ? (
                <p className="text-text-secondary text-sm">加载中...</p>
              ) : data?.recentEssays.length === 0 ? (
                <p className="text-text-secondary text-sm">暂无学生提交作文</p>
              ) : (
                <ul className="space-y-3">
                  {data?.recentEssays.map((essay) => (
                    <li
                      key={essay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-bg-secondary rounded-md"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {essay.title ?? essay.task?.title ?? '未命名作文'}
                        </p>
                        <p className="text-xs text-text-secondary mt-0.5">
                          {essay.student?.name ?? '未知学生'}
                          {essay.student?.studentNo ? ` (${essay.student.studentNo})` : ''} ·{' '}
                          {essay.wordCount} 词 · {new Date(essay.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusColors[essay.status] ?? 'bg-bg-tertiary text-text-secondary'}`}
                        >
                          {statusLabels[essay.status] ?? essay.status}
                        </span>
                        {essay.status === 'completed' && (
                          <span className="text-sm font-medium text-text-primary">
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
    </RoleGuard>
  );
}
