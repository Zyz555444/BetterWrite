'use client';

import { CorrectionResultView } from '@/components/essay/correction-result';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type CorrectionDetail, type Essay, fetcher } from '@/lib/api/fetcher';
import { UserRole } from '@betterwrite/shared';
import { ArrowLeft, Clock, RefreshCw, Save } from 'lucide-react';
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

  const [review, setReview] = useState('');
  const [teacherScore, setTeacherScore] = useState('');
  const [isSavingReview, setIsSavingReview] = useState(false);

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
          setReview(essayRes.data.teacherReview ?? '');
          setTeacherScore(
            essayRes.data.teacherScore !== null && essayRes.data.teacherScore !== undefined
              ? String(essayRes.data.teacherScore)
              : '',
          );
        } else {
          console.warn('[TeacherEssayDetail] getEssay failed:', essayRes.error);
          setError(essayRes.error ?? '获取作文失败');
        }

        if (correctionRes.success && correctionRes.data) {
          setCorrection(correctionRes.data);
        } else {
          setCorrection(null);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[TeacherEssayDetail] loadData error:', message);
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essayId, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!essay) return;

    const payload: { teacherReview?: string; teacherScore?: number } = {};
    if (review.trim()) payload.teacherReview = review.trim();

    if (teacherScore.trim() !== '') {
      const scoreNum = Number(teacherScore);
      if (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        setError('教师分数需在 0-100 之间');
        return;
      }
      payload.teacherScore = scoreNum;
    }

    if (Object.keys(payload).length === 0) {
      setError('请填写评语或分数');
      return;
    }

    setIsSavingReview(true);
    setError(null);
    try {
      const res = await fetcher.reviewEssay(essayId, payload);
      if (res.success && res.data) {
        setEssay(res.data);
        setReview(res.data.teacherReview ?? '');
        setTeacherScore(
          res.data.teacherScore !== null && res.data.teacherScore !== undefined
            ? String(res.data.teacherScore)
            : '',
        );
      } else {
        setError(res.error ?? '保存复核失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存复核失败';
      setError(message);
    } finally {
      setIsSavingReview(false);
    }
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
            <p className="text-neutral-8">加载中...</p>
          ) : error && !essay ? (
            <p className="text-error">{error}</p>
          ) : essay ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge>{statusLabels[essay.status] ?? essay.status}</Badge>
                    <span className="text-copy-14 text-neutral-8 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      提交于 {new Date(essay.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                    {essay.title ?? essay.task?.title ?? '作文详情'}
                  </h1>
                  <p className="text-copy-14 text-neutral-8 mt-1">
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
                  <CardTitle className="text-title-20">原文</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-neutral-10 leading-relaxed whitespace-pre-wrap">
                    {essay.content}
                  </p>
                </CardContent>
              </Card>

              {essay.status === 'pending' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-neutral-10 font-medium">作文正在排队等待批改</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'correcting' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <RefreshCw className="w-10 h-10 text-accent mx-auto mb-3 animate-spin" />
                    <p className="text-neutral-10 font-medium">AI 正在批改中</p>
                  </CardContent>
                </Card>
              )}

              {essay.status === 'failed' && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-error font-medium">批改失败</p>
                    <p className="text-neutral-8 text-copy-14 mt-1">可尝试刷新或检查 worker 日志</p>
                  </CardContent>
                </Card>
              )}

              {correction && (
                <CorrectionResultView correction={correction} originalEssay={essay.content} />
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20 flex items-center gap-2">
                    <Save className="w-4 h-4 text-accent" />
                    教师复核
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSaveReview} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-3 space-y-2">
                        <label
                          htmlFor="teacherReview"
                          className="text-copy-14 font-medium text-neutral-10"
                        >
                          教师评语
                        </label>
                        <textarea
                          id="teacherReview"
                          value={review}
                          onChange={(e) => setReview(e.target.value)}
                          placeholder="输入针对该作文的评语或修改建议..."
                          className="w-full min-h-[100px] rounded-md bg-paper p-3 text-copy-14 text-neutral-10 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="teacherScore"
                          className="text-copy-14 font-medium text-neutral-10"
                        >
                          教师分数
                        </label>
                        <Input
                          id="teacherScore"
                          type="number"
                          min={0}
                          max={100}
                          value={teacherScore}
                          onChange={(e) => setTeacherScore(e.target.value)}
                          placeholder="0-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={isSavingReview}>
                        {isSavingReview ? '保存中...' : '保存复核'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
