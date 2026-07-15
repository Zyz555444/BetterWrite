import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Essay } from '@/lib/api/fetcher-types';
import { serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import { UserRole, formatScore, getEssayStatusLabel } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
import { BookOpen, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

const statusVariants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  correcting: 'default',
  completed: 'default',
  failed: 'destructive',
};

export default async function StudentEssaysPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.STUDENT) redirect(getDashboardPath(user.role));

  let essays: Essay[] = [];
  let error: string | null = null;

  try {
    const res = await serverFetcher.listMyEssays();
    if (res.success && res.data) {
      essays = res.data;
    } else {
      error = res.error ?? '获取作文失败';
      logger.warn({ error }, '[StudentEssays] load failed');
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '获取作文失败';
    logger.error({ err: err instanceof Error ? err.message : err }, '[StudentEssays] load error');
  }

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">我的作文</h1>
          <Link href="/student/tasks">
            <Button variant="secondary">
              <BookOpen className="w-4 h-4 mr-2" />
              去写作
            </Button>
          </Link>
        </div>

        {error && <p className="text-error">{error}</p>}

        {essays.length === 0 && !error && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-neutral-8">还没有提交过作文</p>
              <Link href="/student/tasks" className="inline-block mt-4">
                <Button>开始写作</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4">
          {essays.map((essay) => (
            <Link key={essay.id} href={`/student/essays/${essay.id}`}>
              <Card className="hover:ring-accent/30 transition-colors duration-fast ease-yohaku cursor-pointer group">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusVariants[essay.status] ?? 'secondary'}>
                          {getEssayStatusLabel(essay.status)}
                        </Badge>
                        <span className="text-label-12 text-neutral-7">
                          {new Date(essay.submittedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-medium text-neutral-10 truncate">
                        {essay.title ?? essay.task?.title ?? '未命名作文'}
                      </h3>
                      <p className="text-copy-14 text-neutral-8 mt-1 line-clamp-1">
                        {essay.content}
                      </p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-title-24 font-medium text-neutral-10">
                        {formatScore(essay.totalScore)}
                      </p>
                      <p className="text-label-12 text-neutral-7">/ 15</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-neutral-7 ml-4 group-hover:text-accent transition-colors duration-fast ease-yohaku" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
