'use client';

import { LineChart, RadarChart } from '@/components/charts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { AchievementBadge } from '@/components/student/achievement-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { type StudentProgress, UserRole, formatScore } from '@betterwrite/shared';
import { Award, FileText, Medal, Target, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

const levelConfig: Record<StudentProgress['level'], { label: string; className: string }> = {
  basic: {
    label: '基础',
    className: 'bg-neutral-3 text-neutral-8 border-transparent',
  },
  improving: {
    label: '进阶',
    className: 'bg-info/10 text-info border-transparent',
  },
  advanced: {
    label: '拔尖',
    className: 'bg-warning/10 text-warning border-transparent',
  },
};

export default function StudentProgressPage() {
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[StudentProgress] page mounted');
    setIsLoading(true);
    fetcher
      .getStudentProgress()
      .then((res) => {
        if (res.success && res.data) {
          console.log(
            `[StudentProgress] loaded essays=${res.data.totalEssays} level=${res.data.level}`,
          );
          setProgress(res.data);
        } else {
          console.warn('[StudentProgress] getStudentProgress failed:', res.error);
          setError(res.error ?? '获取成长报告失败');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[StudentProgress] getStudentProgress error:', message);
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const hasReport = !isLoading && !error && progress !== null && progress.totalEssays > 0;

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">写作成长</h1>
            <p className="text-copy-14 text-neutral-8 mt-1">四维能力、进步曲线与成就勋章</p>
          </div>

          {isLoading && <p className="text-neutral-8">加载中...</p>}
          {error && <p className="text-error text-copy-14">{error}</p>}

          {!isLoading && !error && progress !== null && progress.totalEssays === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-neutral-8">完成第一篇作文后即可查看成长报告</p>
              </CardContent>
            </Card>
          )}

          {hasReport && progress !== null && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-copy-14 font-medium text-neutral-8">
                      总作文数
                    </CardTitle>
                    <FileText className="w-4 h-4 text-neutral-7" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-title-28 font-medium text-neutral-10">{progress.totalEssays}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-copy-14 font-medium text-neutral-8">
                      平均分
                    </CardTitle>
                    <Award className="w-4 h-4 text-neutral-7" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-title-28 font-medium text-neutral-10">
                      {formatScore(progress.averageScore)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-copy-14 font-medium text-neutral-8">
                      写作等级
                    </CardTitle>
                    <Medal className="w-4 h-4 text-neutral-7" />
                  </CardHeader>
                  <CardContent>
                    <Badge
                      variant="outline"
                      className={`text-copy-16 px-3 py-1 ${levelConfig[progress.level].className}`}
                    >
                      {levelConfig[progress.level].label}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-title-20 flex items-center gap-2">
                      <Target className="w-4 h-4 text-accent" />
                      四维能力
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <RadarChart data={progress.radarData} size={260} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-title-20 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      进步曲线
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {progress.progressCurve.length === 0 ? (
                      <p className="text-neutral-8 text-copy-14 h-[240px] flex items-center">
                        暂无批改记录
                      </p>
                    ) : (
                      <LineChart data={progress.progressCurve} height={240} color="var(--accent)" />
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20 flex items-center gap-2">
                    <Medal className="w-4 h-4 text-accent" />
                    班级排名
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress.rank === null ? (
                    <p className="text-neutral-8 text-copy-14">暂无排名数据</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-title-28 font-medium text-neutral-10">
                          {progress.rank.classRank}
                        </span>
                        <span className="text-neutral-8">/ {progress.rank.total}</span>
                        <span className="text-copy-14 text-neutral-8 ml-auto">
                          击败 {progress.rank.percentile}% 同学
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all duration-normal"
                          style={{ width: `${progress.rank.percentile}%` }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20 flex items-center gap-2">
                    <Award className="w-4 h-4 text-accent" />
                    成就勋章
                    <span className="text-label-12 font-normal text-neutral-8 ml-2">
                      共 {progress.achievements.length} 枚
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress.achievements.length === 0 ? (
                    <p className="text-neutral-8 text-copy-14">暂无勋章</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {progress.achievements.map((achievement) => (
                        <AchievementBadge key={achievement.id} achievement={achievement} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
