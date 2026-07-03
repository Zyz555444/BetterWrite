'use client';

import { LineChart, PieChart, RadarChart } from '@/components/charts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { formatScore, type StudentAnalytics, UserRole } from '@betterwrite/shared';
import {
  AlertCircle,
  ArrowLeft,
  Award,
  FileText,
  PenLine,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  correcting: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-error/10 text-error',
};

const errorTypeLabels: Record<string, string> = {
  tense: '时态',
  subject_verb: '主谓一致',
  spelling: '拼写',
  plural: '复数',
  article: '冠词',
  preposition: '介词',
  word_form: '词形',
  pronoun: '代词',
  chinglish: '中式英语',
  sentence_structure: '句式结构',
  collocation: '搭配',
};

function resolveErrorLabel(type: string): string {
  return errorTypeLabels[type] ?? type;
}

interface RecentEssay {
  id: string;
  title: string | null;
  status: string;
  totalScore: number | null;
  wordCount: number;
  submittedAt: string;
}

export default function TeacherStudentAnalyticsPage() {
  const params = useParams();
  const studentId = (params?.id as string) ?? '';

  const [data, setData] = useState<StudentAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[TeacherStudentAnalytics] page mounted studentId=${studentId}`);
    if (!studentId) {
      setError('缺少学生 ID');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    fetcher
      .getStudentAnalytics(studentId)
      .then((res) => {
        if (res.success && res.data) {
          console.log(
            `[TeacherStudentAnalytics] analytics loaded essays=${res.data.totalEssays} avg=${res.data.averageScore ?? 'null'}`,
          );
          setData(res.data);
        } else {
          console.warn('[TeacherStudentAnalytics] getStudentAnalytics failed:', res.error);
          setError(res.error ?? '获取学生分析数据失败');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[TeacherStudentAnalytics] getStudentAnalytics error:', message);
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [studentId]);

  const abilitiesData = useMemo(() => {
    if (!data?.abilities) return [];
    return [
      { label: '内容', value: data.abilities.content, max: 25 },
      { label: '语言', value: data.abilities.language, max: 25 },
      { label: '结构', value: data.abilities.structure, max: 25 },
      { label: '卷面', value: data.abilities.presentation, max: 25 },
    ];
  }, [data]);

  const scoreTrendData = useMemo(
    () =>
      (data?.scoreTrend ?? []).map((item) => ({
        label: item.title,
        value: item.score,
      })),
    [data],
  );

  const errorDistData = useMemo(
    () =>
      (data?.errorDistribution ?? []).map((item) => ({
        label: resolveErrorLabel(item.type),
        value: item.count,
      })),
    [data],
  );

  const recentEssays = (data?.recentEssays ?? []) as unknown as RecentEssay[];

  const stats = useMemo(() => {
    return [
      {
        label: '总作文数',
        value: isLoading ? '-' : (data?.totalEssays ?? 0),
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: '平均分',
        value: isLoading ? '-' : formatScore(data?.averageScore ?? null),
        icon: <Award className="w-4 h-4" />,
      },
      {
        label: '已完成任务',
        value: isLoading ? '-' : (data?.scoreTrend?.length ?? 0),
        icon: <Target className="w-4 h-4" />,
      },
      {
        label: '错误类型数',
        value: isLoading ? '-' : (data?.errorDistribution?.length ?? 0),
        icon: <AlertCircle className="w-4 h-4" />,
      },
    ];
  }, [data, isLoading]);

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/teacher/analytics">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回班级分析
              </Button>
            </Link>
          </div>

          <div>
            <h1 className="text-2xl font-serif font-bold text-text-primary">
              {isLoading ? '加载中...' : (data?.studentName ?? '学生报告')}
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              学生 ID：{studentId} · 四维能力、进步曲线与错误分布
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-error text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <Card key={stat.label}>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium text-text-secondary">
                    {stat.label}
                  </CardTitle>
                  <span className="text-text-tertiary">{stat.icon}</span>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Radar + Line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" />
                  四维能力雷达
                </CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                {isLoading ? (
                  <p className="text-text-secondary text-sm h-[240px] flex items-center">
                    加载中...
                  </p>
                ) : (
                  <RadarChart data={abilitiesData} size={260} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-accent" />
                  分数进步曲线
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-text-secondary text-sm h-[240px] flex items-center">
                    加载中...
                  </p>
                ) : (
                  <LineChart data={scoreTrendData} height={240} color="var(--accent)" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Pie + Recent essays */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  错误类型分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-text-secondary text-sm">加载中...</p>
                ) : (
                  <PieChart data={errorDistData} size={200} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  近期作文
                  <span className="text-xs font-normal text-text-secondary ml-2">
                    共 {recentEssays.length} 篇
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-text-secondary text-sm">加载中...</p>
                ) : recentEssays.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无作文记录</p>
                ) : (
                  <ul className="space-y-3">
                    {recentEssays.map((essay) => (
                      <li
                        key={essay.id}
                        className="p-3 bg-bg-secondary rounded-md border border-border"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-text-primary truncate min-w-0 flex-1">
                            {essay.title ?? '未命名作文'}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[essay.status] ?? 'bg-bg-tertiary text-text-secondary'}`}
                          >
                            {statusLabels[essay.status] ?? essay.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary mt-2">
                          {essay.status === 'completed' && essay.totalScore !== null && (
                            <span className="font-medium text-text-primary">
                              {formatScore(essay.totalScore)} 分
                            </span>
                          )}
                          <span>{essay.wordCount} 词</span>
                          <span>
                            提交于 {new Date(essay.submittedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
