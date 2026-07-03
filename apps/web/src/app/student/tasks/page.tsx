'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type EssayTask, fetcher } from '@/lib/api/fetcher';
import { UserRole, getTopicTypeLabel } from '@betterwrite/shared';
import { Calendar, Clock, PenLine } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '进行中',
  closed: '已关闭',
};

export default function StudentTasksPage() {
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .listTasks()
      .then((res) => {
        if (res.success && res.data) {
          setTasks(res.data);
        } else {
          setError(res.error ?? '获取任务失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取任务失败'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">作文任务</h1>
            <Link href="/student/write">
              <Button variant="secondary">
                <PenLine className="w-4 h-4 mr-2" />
                自由写作
              </Button>
            </Link>
          </div>

          {isLoading && <p className="text-neutral-8">加载中...</p>}
          {error && <p className="text-error">{error}</p>}

          {!isLoading && tasks.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-neutral-8">暂无作文任务，去写一篇文章吧</p>
                <Link href="/student/write" className="inline-block mt-4">
                  <Button>自由写作</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tasks.map((task) => (
              <Card key={task.id} className="hover:ring-accent/30 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-2">
                        {getTopicTypeLabel(task.topicType)}
                      </Badge>
                      <CardTitle className="text-title-20">{task.title}</CardTitle>
                    </div>
                    <Badge>{statusLabels[task.status] ?? task.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-8 text-copy-14 line-clamp-2 mb-4">
                    {task.requirements}
                  </p>
                  <div className="flex items-center gap-4 text-label-12 text-neutral-7 mb-4">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {task.wordLimitMin}-{task.wordLimitMax} 词
                    </span>
                    {task.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        截止 {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <Link href={`/student/tasks/${task.id}/write`}>
                    <Button className="w-full">开始写作</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
