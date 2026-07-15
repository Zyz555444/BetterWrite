'use client';

import { CorrectionResultView } from '@/components/essay/correction-result';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type CorrectionDetail, type Essay, fetcher } from '@/lib/api/fetcher';
import { UserRole, getEssayStatusLabel } from '@betterwrite/shared';
import { Clock, RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EssayDetailPage() {
  const params = useParams();
  const essayId = params.id as string;

  const [essay, setEssay] = useState<Essay | null>(null);
  const [correction, setCorrection] = useState<CorrectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 用于手动触发重新加载
  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [essayRes, correctionRes] = await Promise.all([
          fetcher.getEssay(essayId),
          fetcher.getCorrection(essayId),
        ]);
        if (cancelled) return;

        if (essayRes.success && essayRes.data) {
          setEssay(essayRes.data);
        } else {
          setError(essayRes.error ?? '获取作文失败');
        }

        if (correctionRes.success && correctionRes.data) {
          setCorrection(correctionRes.data);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [essayId, refreshKey]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {isLoading ? (
            <p className="text-neutral-8">加载中...</p>
          ) : error && !essay ? (
            <p className="text-error">{error}</p>
          ) : essay ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{getEssayStatusLabel(essay.status)}</Badge>
                    <span className="text-copy-14 text-neutral-8 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      提交于 {new Date(essay.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                    {essay.title ?? essay.task?.title ?? '作文详情'}
                  </h1>
                </div>
                {(essay.status === 'pending' || essay.status === 'correcting') && (
                  <Button variant="secondary" onClick={handleRefresh} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                )}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20">原文</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-10 leading-relaxed whitespace-pre-wrap">
                    {essay.content}
                  </p>
                  <p className="text-copy-14 text-neutral-7 mt-4">词数：{essay.wordCount}</p>
                </CardContent>
              </Card>

              {essay.status === 'pending' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-neutral-10 font-medium">作文正在排队等待批改</p>
                    <p className="text-neutral-8 text-copy-14 mt-1">请稍候刷新查看结果</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'correcting' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-neutral-10 font-medium">AI 正在批改中</p>
                    <p className="text-neutral-8 text-copy-14 mt-1">通常需要几秒到几十秒</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'failed' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-error font-medium">批改失败</p>
                    <p className="text-neutral-8 text-copy-14 mt-1">请尝试刷新或联系老师</p>
                  </CardContent>
                </Card>
              )}

              {correction && (
                <CorrectionResultView correction={correction} originalEssay={essay.content} />
              )}
            </>
          ) : null}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
