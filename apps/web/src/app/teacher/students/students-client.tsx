'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type ImportResult, type StudentListItem, fetcher } from '@/lib/api/fetcher';
import type { TeacherClass } from '@/lib/api/server';
import { StudentTagLabels, formatScore, getStudentTagLabel } from '@betterwrite/shared';
import { Download, Search, Upload, Users, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const tagColors: Record<string, string> = {
  excellent: 'bg-success/10 text-success',
  good: 'bg-info/10 text-info',
  improving: 'bg-warning/10 text-warning',
  attention: 'bg-error/10 text-error',
};

const TEMPLATE_CSV =
  'name,email,studentNo\n张三,zhangsan@example.com,2024001\n李四,lisi@example.com,2024002';

function TagEditor({
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
    console.log(`[TeacherStudents] tag update studentId=${studentId} tag=${newTag}`);
    try {
      const res = await fetcher.updateStudentTag(studentId, newTag);
      if (res.success) {
        onUpdated(newTag);
        setEditing(false);
      } else {
        console.warn('[TeacherStudents] tag update failed:', res.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败';
      console.error('[TeacherStudents] tag update error:', message);
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

function ImportModal({
  classes,
  defaultClassId,
  onClose,
  onImported,
}: {
  classes: TeacherClass[];
  defaultClassId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [targetClassId, setTargetClassId] = useState<string>(defaultClassId);
  const [csv, setCsv] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    console.log('[TeacherStudentsImport] download template');
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleConfirm = async () => {
    setError(null);
    if (!targetClassId) {
      const msg = '请选择目标班级';
      console.warn('[TeacherStudentsImport] validation failed:', msg);
      setError(msg);
      return;
    }
    if (!csv.trim()) {
      const msg = '请粘贴 CSV 内容';
      console.warn('[TeacherStudentsImport] validation failed:', msg);
      setError(msg);
      return;
    }

    console.log(
      `[TeacherStudentsImport] importing classId=${targetClassId} csvLength=${csv.length}`,
    );
    setIsImporting(true);
    try {
      const res = await fetcher.importStudents({ classId: targetClassId, csv });
      if (res.success && res.data) {
        console.log(
          `[TeacherStudentsImport] import done success=${res.data.successCount}/${res.data.totalCount}`,
        );
        setResult(res.data);
        onImported();
      } else {
        console.warn('[TeacherStudentsImport] import failed:', res.error);
        setError(res.error ?? '导入失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败';
      console.error('[TeacherStudentsImport] import error:', message);
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const failedResults = result?.results.filter((r) => !r.success) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-paper rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title-20 font-serif font-medium text-neutral-10">批量导入学生</h2>
          <Button variant="ghost" size="icon" type="button" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-neutral-2 p-4">
              <p className="text-copy-14 text-neutral-10">
                导入完成：成功{' '}
                <span className="font-medium text-success">{result.successCount}</span> / 共{' '}
                <span className="font-medium text-neutral-10">{result.totalCount}</span> 条
              </p>
            </div>

            {failedResults.length > 0 && (
              <div className="space-y-2">
                <p className="text-copy-14 font-medium text-error">
                  失败明细（{failedResults.length} 条）
                </p>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-copy-14">
                    <thead className="bg-neutral-2 text-neutral-8">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">行号</th>
                        <th className="text-left px-3 py-2 font-medium">姓名</th>
                        <th className="text-left px-3 py-2 font-medium">邮箱</th>
                        <th className="text-left px-3 py-2 font-medium">原因</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {failedResults.map((r) => (
                        <tr key={r.line} className="text-neutral-10">
                          <td className="px-3 py-2 text-neutral-8">{r.line}</td>
                          <td className="px-3 py-2">{r.name}</td>
                          <td className="px-3 py-2 text-neutral-8">{r.email}</td>
                          <td className="px-3 py-2 text-error">{r.error ?? '未知错误'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  setResult(null);
                  setCsv('');
                }}
              >
                再次导入
              </Button>
              <Button type="button" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-copy-14 font-medium text-neutral-10">目标班级</span>
              <select
                value={targetClassId}
                onChange={(e) => setTargetClassId(e.target.value)}
                className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
              >
                <option value="">选择班级</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.grade} · {cls.name}（{cls.studentCount} 人）
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-copy-14 font-medium text-neutral-10">CSV 内容</span>
                <Button variant="ghost" size="sm" type="button" onClick={handleDownloadTemplate}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  下载模板
                </Button>
              </div>
              <textarea
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={TEMPLATE_CSV}
                className="w-full min-h-[180px] rounded-md bg-paper p-3 text-copy-14 text-neutral-10 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku font-mono"
              />
              <p className="text-label-12 text-neutral-8">
                CSV 格式：<code className="text-neutral-10">name,email,studentNo</code>
                （表头必须一致），默认密码 123456
              </p>
            </div>

            {error && <p className="text-error text-copy-14">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={onClose}>
                取消
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isImporting}>
                {isImporting ? '导入中...' : '确认导入'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface StudentsClientProps {
  initialClasses: TeacherClass[];
  initialStudents: StudentListItem[];
  initialError: string | null;
}

export function StudentsClient({
  initialClasses,
  initialStudents,
  initialError,
}: StudentsClientProps) {
  const [classes] = useState<TeacherClass[]>(initialClasses);
  const [students, setStudents] = useState<StudentListItem[]>(initialStudents);
  const [classId, setClassId] = useState<string>('');
  const [keyword, setKeyword] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [showImportModal, setShowImportModal] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      console.log(`[TeacherStudents] filter classId=${classId} keyword=${keyword}`);
      loadStudents(classId, keyword);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, keyword]);

  const loadStudents = async (cid: string, kw: string) => {
    setIsLoadingStudents(true);
    setError(null);
    try {
      const params: { classId?: string; keyword?: string } = {};
      if (cid) params.classId = cid;
      if (kw.trim()) params.keyword = kw.trim();
      const res = await fetcher.listStudents(params);
      if (res.success && res.data) {
        console.log(`[TeacherStudents] loaded ${res.data.length} students`);
        setStudents(res.data);
      } else {
        console.warn('[TeacherStudents] failed to load students:', res.error);
        setStudents([]);
        setError(res.error ?? '获取学生失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherStudents] loadStudents error:', message);
      setStudents([]);
      setError(message);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleTagUpdated = (studentId: string, newTag: string) => {
    setStudents((prev) => prev.map((s) => (s.id === studentId ? { ...s, tag: newTag } : s)));
  };

  const handleOpenImport = () => {
    console.log('[TeacherStudentsImport] open modal');
    setShowImportModal(true);
  };

  const handleImported = () => {
    console.log('[TeacherStudentsImport] import succeeded, reloading students');
    loadStudents(classId, keyword);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">学生管理</h1>
          <p className="text-copy-14 text-neutral-8 mt-1">查看班级学生、维护学生标签与批量导入</p>
        </div>
        <Button onClick={handleOpenImport}>
          <Upload className="w-4 h-4 mr-2" />
          批量导入
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-7" />
              <Input
                placeholder="搜索姓名、学号或邮箱"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-7" />
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
              >
                <option value="">全部班级</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.grade} · {cls.name}（{cls.studentCount} 人）
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-error text-copy-14">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-title-20 flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            学生列表
            <span className="text-label-12 font-normal text-neutral-8 ml-2">
              共 {students.length} 人
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingStudents ? (
            <p className="text-neutral-8 text-copy-14">加载中...</p>
          ) : students.length === 0 ? (
            <p className="text-neutral-8 text-copy-14">暂无学生</p>
          ) : (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-copy-14">
                <thead className="text-neutral-8 border-b border-border">
                  <tr>
                    <th className="text-left px-2 py-2 font-medium">姓名</th>
                    <th className="text-left px-2 py-2 font-medium">学号</th>
                    <th className="text-left px-2 py-2 font-medium">班级</th>
                    <th className="text-left px-2 py-2 font-medium">标签</th>
                    <th className="text-left px-2 py-2 font-medium">作文数</th>
                    <th className="text-left px-2 py-2 font-medium">平均分</th>
                    <th className="text-right px-2 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-neutral-2/50">
                      <td className="px-2 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-10">{student.name}</span>
                          <span className="text-label-12 text-neutral-7">{student.email}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-neutral-8">{student.studentNo ?? '-'}</td>
                      <td className="px-2 py-3 text-neutral-8">
                        {student.grade} · {student.className}
                      </td>
                      <td className="px-2 py-3">
                        <TagEditor
                          studentId={student.id}
                          tag={student.tag}
                          onUpdated={(newTag) => handleTagUpdated(student.id, newTag)}
                        />
                      </td>
                      <td className="px-2 py-3 text-neutral-10">{student.essayCount}</td>
                      <td className="px-2 py-3 text-neutral-10">
                        {formatScore(student.averageScore)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <Link href={`/teacher/students/${student.id}`}>
                          <Button variant="ghost" size="sm" type="button">
                            查看详情
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showImportModal && (
        <ImportModal
          classes={classes}
          defaultClassId={classId}
          onClose={() => setShowImportModal(false)}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
