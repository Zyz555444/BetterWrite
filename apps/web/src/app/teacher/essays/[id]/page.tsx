'use client';

import { CorrectionResultView } from '@/components/essay/correction-result';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type CorrectionDetail, type Essay, fetcher } from '@/lib/api/fetcher';
import { UserRole } from '@betterwrite/shared';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

export default function TeacherEssayDetailPage() {
  const params = useParams();
  const essayId = params.id as string;

  const [essay, setEssay] = useState<Essay | null>(null);
  const [correction, setCorrection] = useState<CorrectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey 用于手动触发重新加载
  useEffect(() => {
    console.log(`[TeacherEssayDetail] page mounted essayId=${essayId}`);
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essayId, refreshKey]);

  const loadData = async () => {
    console.log(`[TeacherEssayDetail] loading data essayId=${essayId}`);
    setIsLoading(true);
    setError(null);
    try {
      const [essayRes, correctionRes] = await Promise.all([
        fetcher.getEssay(essayId),
        fetcher.getCorrection(essayId),
      ]);

      if (essayRes.success && essayRes.data) {
        console.log(`[TeacherEssayDetail] essay loaded status=${essayRes.data.status}`);
        setEssay(essayRes.data);
      } else {
        console.warn('[TeacherEssayDetail] getEssay failed:', essayRes.error);
        setError(essayRes.error ?? '获取作文失败');
      }

      if (correctionRes.success && correctionRes.data) {
        console.log('[TeacherEssayDetail] correction loaded');
        setCorrection(correctionRes.data);
      } else {
        console.log('[TeacherEssayDetail] no correction available:', correctionRes.error);
        setCorrection(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherEssayDetail] loadData error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    console.log('[TeacherEssayDetail] refresh clicked');
    setRefreshKey((k) => k + 1);
  };

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/teacher/essays">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <p className="text-text-secondary">加载中...</p>
          ) : error && !essay ? (
            <p className="text-error">{error}</p>
          ) : essay ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{statusLabels[essay.status] ?? essay.status}</Badge>
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      提交于 {new Date(essay.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  <h1 className="text-2xl font-serif font-bold text-text-primary">
                    {essay.title ?? essay.task?.title ?? '作文详情'}
                  </h1>
                  <p className="text-sm text-text-secondary mt-1">
                    学生：{essay.student?.name ?? '未知学生'}
                    {essay.student?.studentNo ? ` (${essay.student.studentNo})` : ''} ·{' '}
                    {essay.wordCount} 词
                  </p>
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
                  <CardTitle className="text-base">原文</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-text-primary leading-relaxed whitespace-pre-wrap">
                    {essay.content}
                  </p>
                </CardContent>
              </Card>

              {essay.status === 'pending' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-text-primary font-medium">作文正在排队等待批改</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'correcting' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-text-primary font-medium">AI 正在批改中</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'failed' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-error font-medium">批改失败</p>
                    <p className="text-text-secondary text-sm mt-1">可尝试刷新或检查 worker 日志</p>
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
