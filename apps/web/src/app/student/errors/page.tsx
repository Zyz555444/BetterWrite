'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { type ErrorBookGroup, UserRole } from '@betterwrite/shared';
import { ArrowRight, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const errorTypeLabels: Record<string, string> = {
  tense: '时态',
  subject_verb: '主谓一致',
  spelling: '拼写',
  plural: '单复数',
  article: '冠词',
  preposition: '介词',
  word_form: '词性',
  pronoun: '代词',
  chinglish: '中式英语',
  sentence_structure: '句子结构',
  collocation: '搭配',
};

export default function StudentErrorBookPage() {
  const [groups, setGroups] = useState<ErrorBookGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[StudentErrorBook] mounted');
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher.getErrorBookGroups();
      if (res.success && res.data) {
        console.log(`[StudentErrorBook] loaded ${res.data.length} groups`);
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
        console.log(`[StudentErrorBook] synced ${res.data.synced} items`);
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
              <h1 className="text-2xl font-serif font-bold text-text-primary">我的错题本</h1>
              <p className="text-sm text-text-secondary mt-1">
                按错误类型查看与消灭错题，持续提升写作能力
              </p>
            </div>
            <Button variant="secondary" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? '同步中...' : '同步错题'}
            </Button>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          {isLoading ? (
            <p className="text-text-secondary text-sm">加载中...</p>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-text-secondary">暂无错题，完成作文批改后自动汇总</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map((group) => {
                const label = errorTypeLabels[group.errorType] ?? group.errorType;
                const percent =
                  group.total > 0 ? Math.round((group.mastered / group.total) * 100) : 0;
                return (
                  <Link key={group.errorType} href={`/student/errors/${group.errorType}`}>
                    <Card className="h-full hover:border-accent/30 transition-colors cursor-pointer">
                      <CardContent className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <Badge variant="destructive">{label}</Badge>
                          <span className="text-xs text-text-tertiary">共 {group.total} 条</span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-text-secondary">
                              已消灭 {group.mastered} / {group.total}
                            </span>
                            <span className="text-success font-medium">{percent}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
                            <div
                              className="h-full rounded-full bg-success transition-all"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          {group.unresolved > 0 && (
                            <p className="text-xs text-text-tertiary">
                              待消灭 {group.unresolved} 条
                            </p>
                          )}
                        </div>

                        <div className="rounded-md bg-bg-secondary p-3">
                          <p className="text-xs text-text-tertiary mb-1">最近一条</p>
                          <p className="text-sm text-text-primary leading-relaxed truncate">
                            <span className="line-through text-error">{group.latestOriginal}</span>
                            <ArrowRight className="inline-block w-3.5 h-3.5 mx-1.5 text-text-tertiary align-middle" />
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
