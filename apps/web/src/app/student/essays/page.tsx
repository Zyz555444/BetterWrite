'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type Essay, fetcher } from '@/lib/api/fetcher';
import { UserRole } from '@betterwrite/shared';
import { formatScore } from '@betterwrite/shared';
import { BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  correcting: 'default',
  completed: 'default',
  failed: 'destructive',
};

export default function StudentEssaysPage() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .listMyEssays()
      .then((res) => {
        if (res.success && res.data) {
          setEssays(res.data);
        } else {
          setError(res.error ?? '获取作文失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取作文失败'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-serif font-bold text-text-primary">我的作文</h1>
            <Link href="/student/tasks">
              <Button variant="secondary">
                <BookOpen className="w-4 h-4 mr-2" />
                去写作
              </Button>
            </Link>
          </div>

          {isLoading && <p className="text-text-secondary">加载中...</p>}
          {error && <p className="text-error">{error}</p>}

          {!isLoading && essays.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-text-secondary">还没有提交过作文</p>
                <Link href="/student/tasks" className="inline-block mt-4">
                  <Button>开始写作</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4">
            {essays.map((essay) => (
              <Link key={essay.id} href={`/student/essays/${essay.id}`}>
                <Card className="hover:border-accent/30 transition-colors cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={statusVariants[essay.status] ?? 'secondary'}>
                            {statusLabels[essay.status] ?? essay.status}
                          </Badge>
                          <span className="text-xs text-text-tertiary">
                            {new Date(essay.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="font-medium text-text-primary truncate">
                          {essay.title ?? essay.task?.title ?? '未命名作文'}
                        </h3>
                        <p className="text-sm text-text-secondary mt-1 line-clamp-1">
                          {essay.content}
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="text-2xl font-bold text-text-primary">
                          {formatScore(essay.totalScore)}
                        </p>
                        <p className="text-xs text-text-tertiary">/ 15</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-text-tertiary ml-4 group-hover:text-accent transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
