'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type Essay, fetcher } from '@/lib/api/fetcher';
import { UserRole, formatScore } from '@betterwrite/shared';
import { FileText, Filter, Search } from 'lucide-react';
import Link from 'next/link';
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

export default function TeacherEssaysPage() {
  const [essays, setEssays] = useState<Essay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    console.log('[TeacherEssays] page mounted');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[TeacherEssays] fetching essays');
      const res = await fetcher.listTeacherEssays();
      if (res.success && res.data) {
        console.log(`[TeacherEssays] loaded ${res.data.length} essays`);
        setEssays(res.data);
      } else {
        console.warn('[TeacherEssays] failed to load essays:', res.error);
        setError(res.error ?? '获取作文失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherEssays] loadData error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEssays = useMemo(() => {
    const list = essays.filter((essay) => {
      const matchStatus = statusFilter === 'all' || essay.status === statusFilter;
      const keyword = search.trim().toLowerCase();
      const matchSearch =
        !keyword ||
        (essay.title ?? essay.task?.title ?? '').toLowerCase().includes(keyword) ||
        (essay.student?.name ?? '').toLowerCase().includes(keyword) ||
        (essay.student?.studentNo ?? '').toLowerCase().includes(keyword);
      return matchStatus && matchSearch;
    });
    console.log(
      `[TeacherEssays] filtered status=${statusFilter} search="${search}" result=${list.length}/${essays.length}`,
    );
    return list;
  }, [essays, statusFilter, search]);

  const handleStatusChange = (value: string) => {
    console.log(`[TeacherEssays] status filter changed to ${value}`);
    setStatusFilter(value);
  };

  const handleSearchChange = (value: string) => {
    console.log(`[TeacherEssays] search changed value="${value}"`);
    setSearch(value);
  };

  const handleView = (essayId: string) => {
    console.log(`[TeacherEssays] navigating to essay detail id=${essayId}`);
  };

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">批改中心</h1>
              <p className="text-sm text-text-secondary mt-1">查看、筛选班级学生提交的作文</p>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                console.log('[TeacherEssays] refresh clicked');
                loadData();
              }}
            >
              刷新
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                  <Input
                    placeholder="搜索学生姓名、学号或作文标题"
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-text-tertiary" />
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-10 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary"
                  >
                    <option value="all">全部状态</option>
                    <option value="pending">等待批改</option>
                    <option value="correcting">批改中</option>
                    <option value="completed">已完成</option>
                    <option value="failed">批改失败</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-error text-sm">{error}</p>}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" />
                作文列表
                <span className="text-xs font-normal text-text-secondary ml-2">
                  共 {filteredEssays.length} 篇
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-text-secondary text-sm">加载中...</p>
              ) : filteredEssays.length === 0 ? (
                <p className="text-text-secondary text-sm">没有匹配的作文</p>
              ) : (
                <ul className="space-y-3">
                  {filteredEssays.map((essay) => (
                    <li
                      key={essay.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-bg-secondary rounded-md"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary truncate">
                          {essay.title ?? essay.task?.title ?? '未命名作文'}
                        </p>
                        <p className="text-xs text-text-secondary mt-1">
                          {essay.student?.name ?? '未知学生'}
                          {essay.student?.studentNo ? ` (${essay.student.studentNo})` : ''} ·{' '}
                          {essay.wordCount} 词 · {new Date(essay.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${statusColors[essay.status] ?? 'bg-bg-tertiary text-text-secondary'}`}
                        >
                          {statusLabels[essay.status] ?? essay.status}
                        </span>
                        {essay.status === 'completed' && (
                          <span className="text-sm font-medium text-text-primary">
                            {formatScore(essay.totalScore)} 分
                          </span>
                        )}
                        <Link href={`/teacher/essays/${essay.id}`}>
                          <Button variant="ghost" size="sm" onClick={() => handleView(essay.id)}>
                            查看
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
