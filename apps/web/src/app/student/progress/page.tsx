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
    className: 'bg-bg-tertiary text-text-secondary border-transparent',
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
            <h1 className="text-2xl font-serif font-bold text-text-primary">写作成长</h1>
            <p className="text-sm text-text-secondary mt-1">四维能力、进步曲线与成就勋章</p>
          </div>

          {isLoading && <p className="text-text-secondary">加载中...</p>}
          {error && <p className="text-error text-sm">{error}</p>}

          {!isLoading && !error && progress !== null && progress.totalEssays === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-text-secondary">完成第一篇作文后即可查看成长报告</p>
              </CardContent>
            </Card>
          )}

          {hasReport && progress !== null && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-text-secondary">
                      总作文数
                    </CardTitle>
                    <FileText className="w-4 h-4 text-text-tertiary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-text-primary">{progress.totalEssays}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-text-secondary">
                      平均分
                    </CardTitle>
                    <Award className="w-4 h-4 text-text-tertiary" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-text-primary">
                      {formatScore(progress.averageScore)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium text-text-secondary">
                      写作等级
                    </CardTitle>
                    <Medal className="w-4 h-4 text-text-tertiary" />
                  </CardHeader>
                  <CardContent>
                    <Badge
                      variant="outline"
                      className={`text-base px-3 py-1 ${levelConfig[progress.level].className}`}
                    >
                      {levelConfig[progress.level].label}
                    </Badge>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
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
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-accent" />
                      进步曲线
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {progress.progressCurve.length === 0 ? (
                      <p className="text-text-secondary text-sm h-[240px] flex items-center">
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <Medal className="w-4 h-4 text-accent" />
                    班级排名
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress.rank === null ? (
                    <p className="text-text-secondary text-sm">暂无排名数据</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-text-primary">
                          {progress.rank.classRank}
                        </span>
                        <span className="text-text-secondary">/ {progress.rank.total}</span>
                        <span className="text-sm text-text-secondary ml-auto">
                          击败 {progress.rank.percentile}% 同学
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-bg-tertiary overflow-hidden">
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
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="w-4 h-4 text-accent" />
                    成就勋章
                    <span className="text-xs font-normal text-text-secondary ml-2">
                      共 {progress.achievements.length} 枚
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {progress.achievements.length === 0 ? (
                    <p className="text-text-secondary text-sm">暂无勋章</p>
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
