'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type EssayTask, fetcher } from '@/lib/api/fetcher';
import { TopicTypeLabels, UserRole } from '@betterwrite/shared';
import { Calendar, PenLine, Plus, School, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已截止',
};

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export default function TeacherTasksPage() {
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: '',
    topicType: 'narration',
    requirements: '',
    keyPoints: '',
    classId: '',
    wordLimitMin: 80,
    wordLimitMax: 125,
    dueDate: '',
  });

  useEffect(() => {
    console.log('[TeacherTasks] page mounted');
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log('[TeacherTasks] loading classes and tasks');
      const [classesRes, tasksRes] = await Promise.all([
        fetcher.listTeacherClasses(),
        fetcher.listTasks(),
      ]);

      if (classesRes.success && classesRes.data) {
        console.log(`[TeacherTasks] loaded ${classesRes.data.length} classes`);
        setClasses(classesRes.data);
      } else {
        console.warn('[TeacherTasks] failed to load classes:', classesRes.error);
        setError(classesRes.error ?? '获取班级失败');
      }

      if (tasksRes.success && tasksRes.data) {
        console.log(`[TeacherTasks] loaded ${tasksRes.data.length} tasks`);
        setTasks(tasksRes.data);
      } else {
        console.warn('[TeacherTasks] failed to load tasks:', tasksRes.error);
        setError(tasksRes.error ?? '获取任务失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherTasks] loadData error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      console.log(`[TeacherTasks] form changed field=${field} value=`, value);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.classId || !form.requirements.trim()) {
      const msg = '请填写标题、班级和要求';
      console.warn('[TeacherTasks] submit validation failed:', msg);
      setError(msg);
      return;
    }

    const payload = {
      title: form.title.trim(),
      topicType: form.topicType,
      requirements: form.requirements.trim(),
      keyPoints: form.keyPoints
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      classId: form.classId,
      wordLimitMin: Number(form.wordLimitMin),
      wordLimitMax: Number(form.wordLimitMax),
      dueDate: form.dueDate || undefined,
    };

    console.log('[TeacherTasks] submitting task:', JSON.stringify(payload));
    setIsSubmitting(true);
    try {
      const res = await fetcher.createTask(payload);
      if (res.success && res.data) {
        const newTask = res.data;
        console.log('[TeacherTasks] task created id=', newTask.id);
        setTasks((prev) => [newTask, ...prev]);
        setShowForm(false);
        setForm({
          title: '',
          topicType: 'narration',
          requirements: '',
          keyPoints: '',
          classId: '',
          wordLimitMin: 80,
          wordLimitMax: 125,
          dueDate: '',
        });
      } else {
        console.warn('[TeacherTasks] createTask failed:', res.error);
        setError(res.error ?? '创建失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      console.error('[TeacherTasks] createTask error:', message);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getClassLabel = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    return cls ? `${cls.grade} · ${cls.name}` : classId;
  };

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">作文任务</h1>
              <p className="text-sm text-text-secondary mt-1">布置、查看和管理班级作文任务</p>
            </div>
            <Button
              onClick={() => {
                console.log(`[TeacherTasks] toggle form current=${showForm}`);
                setShowForm((v) => !v);
              }}
            >
              {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {showForm ? '取消' : '新建任务'}
            </Button>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-accent" />
                  新建作文任务
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="title" className="text-sm font-medium text-text-primary">
                        标题
                      </label>
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => handleChange('title', e.target.value)}
                        placeholder="例如：My Favorite Season"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="classId" className="text-sm font-medium text-text-primary">
                        班级
                      </label>
                      <select
                        id="classId"
                        value={form.classId}
                        onChange={(e) => handleChange('classId', e.target.value)}
                        required
                        className="w-full h-10 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary"
                      >
                        <option value="">选择班级</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.grade} · {cls.name}（{cls.studentCount} 人）
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="topicType" className="text-sm font-medium text-text-primary">
                        体裁
                      </label>
                      <select
                        id="topicType"
                        value={form.topicType}
                        onChange={(e) => handleChange('topicType', e.target.value)}
                        className="w-full h-10 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary"
                      >
                        {Object.entries(TopicTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="wordLimitMin"
                        className="text-sm font-medium text-text-primary"
                      >
                        最少词数
                      </label>
                      <Input
                        id="wordLimitMin"
                        type="number"
                        value={form.wordLimitMin}
                        onChange={(e) => handleChange('wordLimitMin', Number(e.target.value))}
                        min={40}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="wordLimitMax"
                        className="text-sm font-medium text-text-primary"
                      >
                        最多词数
                      </label>
                      <Input
                        id="wordLimitMax"
                        type="number"
                        value={form.wordLimitMax}
                        onChange={(e) => handleChange('wordLimitMax', Number(e.target.value))}
                        min={40}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="requirements" className="text-sm font-medium text-text-primary">
                      写作要求
                    </label>
                    <textarea
                      id="requirements"
                      value={form.requirements}
                      onChange={(e) => handleChange('requirements', e.target.value)}
                      placeholder="描述题目背景、写作要点和评分标准..."
                      className="w-full min-h-[100px] rounded-md border border-border bg-bg-primary p-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="keyPoints" className="text-sm font-medium text-text-primary">
                      评分要点（每行一条）
                    </label>
                    <textarea
                      id="keyPoints"
                      value={form.keyPoints}
                      onChange={(e) => handleChange('keyPoints', e.target.value)}
                      placeholder="例如：&#10;包含至少两个季节特点&#10;使用恰当的连接词"
                      className="w-full min-h-[80px] rounded-md border border-border bg-bg-primary p-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="dueDate" className="text-sm font-medium text-text-primary">
                      截止时间（可选）
                    </label>
                    <Input
                      id="dueDate"
                      type="datetime-local"
                      value={form.dueDate}
                      onChange={(e) => handleChange('dueDate', e.target.value)}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? '创建中...' : '创建任务'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">任务列表</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-text-secondary text-sm">加载中...</p>
              ) : tasks.length === 0 ? (
                <p className="text-text-secondary text-sm">暂无任务，点击右上角创建</p>
              ) : (
                <ul className="space-y-3">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-bg-secondary rounded-md"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-text-primary truncate">{task.title}</p>
                          <Badge variant="secondary">
                            {TopicTypeLabels[task.topicType as keyof typeof TopicTypeLabels] ??
                              task.topicType}
                          </Badge>
                          <Badge>{statusLabels[task.status] ?? task.status}</Badge>
                        </div>
                        <p className="text-xs text-text-secondary flex items-center gap-2">
                          <School className="w-3 h-3" />
                          {getClassLabel(task.classId)}
                          <span>·</span>
                          <PenLine className="w-3 h-3" />
                          {task.wordLimitMin}-{task.wordLimitMax} 词
                          {task.dueDate && (
                            <>
                              <span>·</span>
                              <Calendar className="w-3 h-3" />
                              {new Date(task.dueDate).toLocaleString()}
                            </>
                          )}
                        </p>
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
