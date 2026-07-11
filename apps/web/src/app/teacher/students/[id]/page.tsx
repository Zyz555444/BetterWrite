'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type StudentDetail, fetcher } from '@/lib/api/fetcher';
import {
  StudentTagLabels,
  UserRole,
  formatScore,
  getEssayStatusLabel,
  getStudentTagLabel,
  getTopicTypeLabel,
} from '@betterwrite/shared';
import { ArrowLeft, BookOpen, Mail, School, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const tagColors: Record<string, string> = {
  excellent: 'bg-success/10 text-success',
  good: 'bg-info/10 text-info',
  improving: 'bg-warning/10 text-warning',
  attention: 'bg-error/10 text-error',
};

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  correcting: 'bg-info/10 text-info',
  completed: 'bg-success/10 text-success',
  failed: 'bg-error/10 text-error',
};

function TagSelector({
  studentId,
  tag,
  onUpdated,
}: {
  studentId: string;
  tag: string | null;
  onUpdated: (newTag: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing]);

  const handleSelect = async (newTag: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetcher.updateStudentTag(studentId, newTag);
      if (res.success) {
        onUpdated(newTag);
        setEditing(false);
      } else {
        // silently ignore; UI does not show tag errors
      }
    } catch {
      // silently ignore; UI does not show tag errors
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setEditing((v) => !v)}
        disabled={loading}
        className={`text-label-12 px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity duration-fast ease-yohaku ${tag ? tagColors[tag] : 'bg-neutral-3 text-neutral-8'}`}
      >
        {tag ? getStudentTagLabel(tag) : '设置标签'}
      </button>
      {editing && (
        <div className="absolute z-20 mt-1 left-0 min-w-[120px] rounded-md bg-paper ring-1 ring-border py-1">
          {Object.entries(StudentTagLabels).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => handleSelect(value)}
              className={`w-full text-left px-3 py-1.5 text-label-12 hover:bg-neutral-2 transition-colors duration-fast ease-yohaku ${tag === value ? 'font-medium text-accent' : 'text-neutral-10'}`}
            >
              <span className={`inline-block w-2 h-2 rounded-full mr-2 ${tagColors[value]}`} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadStudent = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetcher.getStudentDetail(studentId);
        if (cancelled) return;
        if (res.success && res.data) {
          setStudent(res.data);
        } else {
          setError(res.error ?? '获取学生失败');
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadStudent();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const handleTagUpdated = (newTag: string) => {
    setStudent((prev) => (prev ? { ...prev, tag: newTag } : prev));
  };

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/teacher/students">
              <Button variant="ghost" size="sm" type="button">
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回学生列表
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <p className="text-neutral-8">加载中...</p>
          ) : error && !student ? (
            <p className="text-error">{error}</p>
          ) : student ? (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                    {student.name}
                  </h1>
                  <p className="text-copy-14 text-neutral-8 mt-1">学生详情</p>
                </div>
                <TagSelector
                  studentId={student.id}
                  tag={student.tag}
                  onUpdated={handleTagUpdated}
                />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20 flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent" />
                    基本信息
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-copy-14">
                    <div>
                      <dt className="text-neutral-8">姓名</dt>
                      <dd className="text-neutral-10 font-medium mt-0.5">{student.name}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-8">学号</dt>
                      <dd className="text-neutral-10 font-medium mt-0.5">
                        {student.studentNo ?? '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-8 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        邮箱
                      </dt>
                      <dd className="text-neutral-10 font-medium mt-0.5">{student.email}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-8 flex items-center gap-1">
                        <School className="w-3.5 h-3.5" />
                        班级
                      </dt>
                      <dd className="text-neutral-10 font-medium mt-0.5">
                        {student.classes.length > 0
                          ? student.classes
                              .map((c) =>
                                c.name ? `${c.grade ?? ''} · ${c.name}` : (c.grade ?? '-'),
                              )
                              .join('，')
                          : '-'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-neutral-8">当前标签</dt>
                      <dd className="mt-0.5">
                        <TagSelector
                          studentId={student.id}
                          tag={student.tag}
                          onUpdated={handleTagUpdated}
                        />
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-copy-14 font-medium text-neutral-8">
                      作文数
                    </CardTitle>
                    <BookOpen className="w-4 h-4 text-neutral-7" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-title-28 font-medium text-neutral-10">
                      {student.essayCount}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-copy-14 font-medium text-neutral-8">
                      平均分
                    </CardTitle>
                    <BookOpen className="w-4 h-4 text-neutral-7" />
                  </CardHeader>
                  <CardContent>
                    <p className="text-title-28 font-medium text-neutral-10">
                      {formatScore(student.averageScore)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-title-20 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-accent" />
                    近期作文
                    <span className="text-label-12 font-normal text-neutral-8 ml-2">
                      共 {student.recentEssays.length} 篇
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {student.recentEssays.length === 0 ? (
                    <p className="text-neutral-8 text-copy-14">暂无作文记录</p>
                  ) : (
                    <div className="overflow-x-auto -mx-2">
                      <table className="w-full text-copy-14">
                        <thead className="text-neutral-8 border-b border-border">
                          <tr>
                            <th className="text-left px-2 py-2 font-medium">标题</th>
                            <th className="text-left px-2 py-2 font-medium">体裁</th>
                            <th className="text-left px-2 py-2 font-medium">状态</th>
                            <th className="text-left px-2 py-2 font-medium">分数</th>
                            <th className="text-left px-2 py-2 font-medium">词数</th>
                            <th className="text-left px-2 py-2 font-medium">提交时间</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {student.recentEssays.map((essay) => (
                            <tr key={essay.id} className="hover:bg-neutral-2/50">
                              <td className="px-2 py-3 text-neutral-10 font-medium">
                                {essay.title || '未命名作文'}
                              </td>
                              <td className="px-2 py-3 text-neutral-8">
                                {essay.topicType ? getTopicTypeLabel(essay.topicType) : '-'}
                              </td>
                              <td className="px-2 py-3">
                                <span
                                  className={`text-label-12 px-2 py-0.5 rounded-full ${statusColors[essay.status] ?? 'bg-neutral-3 text-neutral-8'}`}
                                >
                                  {getEssayStatusLabel(essay.status)}
                                </span>
                              </td>
                              <td className="px-2 py-3 text-neutral-10">
                                {formatScore(essay.totalScore)}
                              </td>
                              <td className="px-2 py-3 text-neutral-8">{essay.wordCount}</td>
                              <td className="px-2 py-3 text-neutral-8">
                                {new Date(essay.submittedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
