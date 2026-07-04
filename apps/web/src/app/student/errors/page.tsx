'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { type ErrorBookGroup, UserRole, getErrorTypeLabel } from '@betterwrite/shared';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StudentErrorBookPage() {
  const [groups, setGroups] = useState<ErrorBookGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher.getErrorBookGroups();
      if (res.success && res.data) {
        setGroups(res.data);
      } else {
        console.warn('[StudentErrorBook] load failed:', res.error);
        setError(res.error ?? '获取错题本失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[StudentErrorBook] load error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetcher.syncErrorBook();
      if (res.success && res.data) {
        await loadGroups();
      } else {
        console.warn('[StudentErrorBook] sync failed:', res.error);
        setError(res.error ?? '同步失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '同步失败';
      console.error('[StudentErrorBook] sync error:', message);
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-title-24 font-serif font-medium text-neutral-10">我的错题本</h1>
              <p className="text-copy-14 text-neutral-8 mt-1">
                按错误类型查看与消灭错题，持续提升写作能力
              </p>
            </div>
            <Button variant="secondary" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '同步中...' : '同步错题'}
            </Button>
          </div>

          {error && <p className="text-error text-copy-14">{error}</p>}

          {isLoading ? (
            <p className="text-neutral-8 text-copy-14">加载中...</p>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-neutral-8">暂无错题，完成作文批改后自动汇总</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const label = getErrorTypeLabel(group.errorType);
                const percent =
                  group.total > 0 ? Math.round((group.mastered / group.total) * 100) : 0;
                return (
                  <Link key={group.errorType} href={`/student/errors/${group.errorType}`}>
                    <Card className="h-full hover:ring-accent/30 transition-colors duration-fast ease-yohaku cursor-pointer">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="destructive">{label}</Badge>
                          <span className="text-label-12 text-neutral-7">共 {group.total} 条</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-label-12">
                            <span className="text-neutral-8">
                              已消灭 {group.mastered} / {group.total}
                            </span>
                            <span className="text-success font-medium">{percent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-neutral-3 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-success transition-all duration-normal ease-yohaku"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {group.unresolved > 0 && (
                            <p className="text-label-12 text-neutral-7">
                              待消灭 {group.unresolved} 条
                            </p>
                          )}
                        </div>

                        <div className="rounded-md bg-neutral-2 p-3">
                          <p className="text-label-12 text-neutral-7 mb-1">最近一条</p>
                          <p className="text-copy-14 text-neutral-10 leading-relaxed truncate">
                            <span className="line-through text-error">{group.latestOriginal}</span>
                            <ArrowRight className="inline-block w-3.5 h-3.5 mx-1.5 text-neutral-7 align-middle" />
                            <span className="text-success font-medium">
                              {group.latestCorrected}
                            </span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
