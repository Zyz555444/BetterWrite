'use client';

import { BarChart, LineChart } from '@/components/charts';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import {
  type ClassAnalytics,
  UserRole,
  formatScore,
  getTopicTypeLabel,
  getErrorTypeLabel,
} from '@betterwrite/shared';
import {
  AlertCircle,
  BarChart3,
  Download,
  FileText,
  School,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}


export default function TeacherAnalyticsPage() {
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [analytics, setAnalytics] = useState<ClassAnalytics | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[TeacherAnalytics] loading classes');
    setIsLoadingClasses(true);
    fetcher
      .listTeacherClasses()
      .then((res) => {
        if (res.success && res.data) {
          console.log(`[TeacherAnalytics] classes loaded count=${res.data.length}`);
          setClasses(res.data);
          if (res.data.length > 0) {
            const firstId = res.data[0].id;
            setSelectedClassId(firstId);
            console.log(`[TeacherAnalytics] auto-selected first class id=${firstId}`);
          }
        } else {
          console.warn('[TeacherAnalytics] listTeacherClasses failed:', res.error);
          setError(res.error ?? '获取班级列表失败');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[TeacherAnalytics] listTeacherClasses error:', message);
        setError(message);
      })
      .finally(() => setIsLoadingClasses(false));
  }, []);

  const loadAnalytics = useCallback(async (classId: string) => {
    if (!classId) return;
    console.log(`[TeacherAnalytics] class selected id=${classId}`);
    setIsLoadingAnalytics(true);
    setError(null);
    try {
      const res = await fetcher.getClassAnalytics(classId);
      if (res.success && res.data) {
        console.log(
          `[TeacherAnalytics] analytics loaded essays=${res.data.totalEssays} students=${res.data.totalStudents}`,
        );
        setAnalytics(res.data);
      } else {
        console.warn('[TeacherAnalytics] getClassAnalytics failed:', res.error);
        setError(res.error ?? '获取班级分析数据失败');
        setAnalytics(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherAnalytics] getClassAnalytics error:', message);
      setError(message);
      setAnalytics(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadAnalytics(selectedClassId);
    }
  }, [selectedClassId, loadAnalytics]);

  const handleClassChange = (value: string) => {
    setSelectedClassId(value);
  };

  const handleExport = async () => {
    if (!selectedClassId) return;
    console.log(`[TeacherAnalytics] export clicked classId=${selectedClassId}`);
    setIsExporting(true);
    setExportError(null);
    try {
      await fetcher.exportClassAnalytics(selectedClassId);
      console.log(`[TeacherAnalytics] export completed classId=${selectedClassId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败';
      console.error('[TeacherAnalytics] export error:', message);
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId),
    [classes, selectedClassId],
  );

  const scoreTrendData = useMemo(
    () =>
      (analytics?.scoreTrend ?? []).map((item) => ({
        label: item.taskTitle,
        value: item.averageScore,
      })),
    [analytics],
  );

  const scoreDistData = useMemo(
    () =>
      (analytics?.scoreDistribution ?? []).map((item) => ({
        label: item.range,
        value: item.count,
      })),
    [analytics],
  );

  const topicTypeData = useMemo(
    () =>
      (analytics?.topicTypeComparison ?? []).map((item) => ({
        label: getTopicTypeLabel(item.topicType),
        value: item.averageScore,
      })),
    [analytics],
  );

  const topErrors = analytics?.topErrors ?? [];
  const maxErrorCount = useMemo(
    () => topErrors.reduce((max, e) => Math.max(max, e.count), 0) || 1,
    [topErrors],
  );

  const stats = useMemo(() => {
    return [
      {
        label: '班级人数',
        value: isLoadingAnalytics ? '-' : (analytics?.totalStudents ?? 0),
        icon: <Users className="w-4 h-4" />,
      },
      {
        label: '作文总数',
        value: isLoadingAnalytics ? '-' : (analytics?.totalEssays ?? 0),
        icon: <FileText className="w-4 h-4" />,
      },
      {
        label: '平均分',
        value: isLoadingAnalytics ? '-' : formatScore(analytics?.averageScore ?? null),
        icon: <BarChart3 className="w-4 h-4" />,
      },
      {
        label: '任务数',
        value: isLoadingAnalytics ? '-' : (analytics?.scoreTrend?.length ?? 0),
        icon: <TrendingUp className="w-4 h-4" />,
      },
    ];
  }, [analytics, isLoadingAnalytics]);

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">数据分析</h1>
              <p className="text-sm text-text-secondary mt-1">
                查看班级作文成绩分布、错误类型与体裁对比
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={!selectedClassId || isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? '导出中...' : '导出 CSV'}
            </Button>
          </div>

          {/* Class selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium text-text-primary">选择班级</span>
                </div>
                <select
                  value={selectedClassId}
                  onChange={(e) => handleClassChange(e.target.value)}
                  disabled={isLoadingClasses}
                  className="h-10 flex-1 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20"
                >
                  {isLoadingClasses ? (
                    <option value="">加载中...</option>
                  ) : classes.length === 0 ? (
                    <option value="">暂无任教班级</option>
                  ) : (
                    classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.grade} · {cls.name}（{cls.studentCount} 人）
                      </option>
                    ))
                  )}
                </select>
              </div>
              {exportError && <p className="text-error text-xs mt-3">{exportError}</p>}
            </CardContent>
          </Card>

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

          {selectedClass && (
            <p className="text-xs text-text-tertiary">
              当前班级：{selectedClass.grade} · {selectedClass.name}
            </p>
          )}

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" />
                  平均分趋势
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <p className="text-text-secondary text-sm h-[200px] flex items-center">
                    加载中...
                  </p>
                ) : (
                  <LineChart data={scoreTrendData} height={220} color="var(--accent)" />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" />
                  分数段分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <p className="text-text-secondary text-sm h-[200px] flex items-center">
                    加载中...
                  </p>
                ) : (
                  <BarChart data={scoreDistData} height={220} color="var(--accent)" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  高频错误 Top 10
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <p className="text-text-secondary text-sm">加载中...</p>
                ) : topErrors.length === 0 ? (
                  <p className="text-text-secondary text-sm">暂无数据</p>
                ) : (
                  <ul className="space-y-2.5">
                    {topErrors.slice(0, 10).map((err, i) => (
                      <li key={`${err.type}-${i}`} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-text-tertiary tabular-nums w-5 shrink-0">
                              {i + 1}
                            </span>
                            <Badge variant="secondary" className="shrink-0">
                              {getErrorTypeLabel(err.type)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-text-secondary tabular-nums">
                            <span>{err.count} 次</span>
                            <span className="text-text-tertiary">{err.percentage}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${(err.count / maxErrorCount) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" />
                  体裁平均分对比
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingAnalytics ? (
                  <p className="text-text-secondary text-sm h-[220px] flex items-center">
                    加载中...
                  </p>
                ) : (
                  <BarChart data={topicTypeData} height={220} color="var(--accent)" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
