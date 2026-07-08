'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type EssayTask, fetcher } from '@/lib/api/fetcher';
import { TopicTypeLabels, UserRole } from '@betterwrite/shared';
import { Bot, Calendar, PenLine, Plus, School, Sparkles, X } from 'lucide-react';
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
  const [showAiForm, setShowAiForm] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
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
  const [aiForm, setAiForm] = useState({
    topic: '',
    topicType: '',
    gradeLevel: 'Grade 7-9 (Chinese middle school)',
    wordLimitMin: 80,
    wordLimitMax: 125,
  });

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [classesRes, tasksRes] = await Promise.all([
          fetcher.listTeacherClasses(),
          fetcher.listTasks(),
        ]);
        if (cancelled) return;

        if (classesRes.success && classesRes.data) {
          setClasses(classesRes.data);
        } else {
          setError(classesRes.error ?? '获取班级失败');
        }

        if (tasksRes.success && tasksRes.data) {
          setTasks(tasksRes.data);
        } else {
          setError(tasksRes.error ?? '获取任务失败');
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '加载失败';
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
  }, []);

  const handleChange = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
  };

  const handleAiChange = (field: keyof typeof aiForm, value: string | number) => {
    setAiForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.classId || !form.requirements.trim()) {
      setError('请填写标题、班级和要求');
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

    setIsSubmitting(true);
    try {
      const res = await fetcher.createTask(payload);
      if (res.success && res.data) {
        const newTask = res.data;
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

  const handleAiGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!aiForm.topic.trim()) {
      setError('请输入 AI 出题主题');
      return;
    }

    setIsAiGenerating(true);
    try {
      const res = await fetcher.aiGenerateTask({
        topic: aiForm.topic.trim(),
        topicType: aiForm.topicType || undefined,
        gradeLevel: aiForm.gradeLevel || undefined,
        wordLimitMin: Number(aiForm.wordLimitMin),
        wordLimitMax: Number(aiForm.wordLimitMax),
      });
      if (res.success && res.data) {
        const generated = res.data;
        setForm((prev) => ({
          ...prev,
          title: generated.title,
          topicType: generated.topicType,
          requirements: generated.requirements,
          keyPoints: generated.keyPoints.join('\n'),
          wordLimitMin: generated.wordLimitMin ?? prev.wordLimitMin,
          wordLimitMax: generated.wordLimitMax ?? prev.wordLimitMax,
        }));
        setShowAiForm(false);
        setShowForm(true);
        setAiForm({
          topic: '',
          topicType: '',
          gradeLevel: 'Grade 7-9 (Chinese middle school)',
          wordLimitMin: 80,
          wordLimitMax: 125,
        });
      } else {
        console.warn('[TeacherTasks] aiGenerateTask failed:', res.error);
        setError(res.error ?? 'AI 出题失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI 出题失败';
      console.error('[TeacherTasks] aiGenerateTask error:', message);
      setError(message);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handlePublish = async (id: string) => {
    setError(null);
    try {
      const res = await fetcher.publishTask(id);
      if (res.success && res.data) {
        const updated = res.data;
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } else {
        setError(res.error ?? '发布失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '发布失败';
      setError(message);
    }
  };

  const handleClose = async (id: string) => {
    setError(null);
    try {
      const res = await fetcher.closeTask(id);
      if (res.success && res.data) {
        const updated = res.data;
        setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      } else {
        setError(res.error ?? '截止失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '截止失败';
      setError(message);
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
              <h1 className="text-title-24 font-serif font-medium text-neutral-10">作文任务</h1>
              <p className="text-copy-14 text-neutral-8 mt-1">布置、查看和管理班级作文任务</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAiForm((v) => !v);
                  setShowForm(false);
                }}
              >
                {showAiForm ? (
                  <X className="w-4 h-4 mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {showAiForm ? '取消' : 'AI 出题'}
              </Button>
              <Button
                onClick={() => {
                  setShowForm((v) => !v);
                  setShowAiForm(false);
                }}
              >
                {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                {showForm ? '取消' : '新建任务'}
              </Button>
            </div>
          </div>

          {error && <p className="text-error text-copy-14">{error}</p>}

          {showAiForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title-20 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-accent" />
                  AI 辅助出题
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAiGenerate} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="aiTopic" className="text-copy-14 font-medium text-neutral-10">
                      主题 / 提示词
                    </label>
                    <Input
                      id="aiTopic"
                      value={aiForm.topic}
                      onChange={(e) => handleAiChange('topic', e.target.value)}
                      placeholder="例如：一次难忘的旅行"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="aiTopicType"
                        className="text-copy-14 font-medium text-neutral-10"
                      >
                        体裁（可选）
                      </label>
                      <select
                        id="aiTopicType"
                        value={aiForm.topicType}
                        onChange={(e) => handleAiChange('topicType', e.target.value)}
                        className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                      >
                        <option value="">自动选择</option>
                        {Object.entries(TopicTypeLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="aiWordLimitMin"
                        className="text-copy-14 font-medium text-neutral-10"
                      >
                        最少词数
                      </label>
                      <Input
                        id="aiWordLimitMin"
                        type="number"
                        value={aiForm.wordLimitMin}
                        onChange={(e) => handleAiChange('wordLimitMin', Number(e.target.value))}
                        min={20}
                        max={500}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="aiWordLimitMax"
                        className="text-copy-14 font-medium text-neutral-10"
                      >
                        最多词数
                      </label>
                      <Input
                        id="aiWordLimitMax"
                        type="number"
                        value={aiForm.wordLimitMax}
                        onChange={(e) => handleAiChange('wordLimitMax', Number(e.target.value))}
                        min={20}
                        max={500}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isAiGenerating}>
                      {isAiGenerating ? '生成中...' : '生成并填入表单'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title-20 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-accent" />
                  新建作文任务
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="title" className="text-copy-14 font-medium text-neutral-10">
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
                      <label htmlFor="classId" className="text-copy-14 font-medium text-neutral-10">
                        班级
                      </label>
                      <select
                        id="classId"
                        value={form.classId}
                        onChange={(e) => handleChange('classId', e.target.value)}
                        required
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="topicType"
                        className="text-copy-14 font-medium text-neutral-10"
                      >
                        体裁
                      </label>
                      <select
                        id="topicType"
                        value={form.topicType}
                        onChange={(e) => handleChange('topicType', e.target.value)}
                        className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
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
                        className="text-copy-14 font-medium text-neutral-10"
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
                        className="text-copy-14 font-medium text-neutral-10"
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
                    <label
                      htmlFor="requirements"
                      className="text-copy-14 font-medium text-neutral-10"
                    >
                      写作要求
                    </label>
                    <textarea
                      id="requirements"
                      value={form.requirements}
                      onChange={(e) => handleChange('requirements', e.target.value)}
                      placeholder="描述题目背景、写作要点和评分标准..."
                      className="w-full min-h-[100px] rounded-md bg-paper p-3 text-copy-14 text-neutral-10 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="keyPoints" className="text-copy-14 font-medium text-neutral-10">
                      评分要点（每行一条）
                    </label>
                    <textarea
                      id="keyPoints"
                      value={form.keyPoints}
                      onChange={(e) => handleChange('keyPoints', e.target.value)}
                      placeholder="例如：&#10;包含至少两个季节特点&#10;使用恰当的连接词"
                      className="w-full min-h-[80px] rounded-md bg-paper p-3 text-copy-14 text-neutral-10 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="dueDate" className="text-copy-14 font-medium text-neutral-10">
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
              <CardTitle className="text-title-20">任务列表</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-neutral-8 text-copy-14">加载中...</p>
              ) : tasks.length === 0 ? (
                <p className="text-neutral-8 text-copy-14">暂无任务，点击右上角创建</p>
              ) : (
                <ul className="space-y-3">
                  {tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-neutral-2 rounded-md"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-neutral-10 truncate">{task.title}</p>
                          <Badge variant="secondary">
                            {TopicTypeLabels[task.topicType as keyof typeof TopicTypeLabels] ??
                              task.topicType}
                          </Badge>
                          <Badge>{statusLabels[task.status] ?? task.status}</Badge>
                        </div>
                        <p className="text-label-12 text-neutral-8 flex items-center gap-2">
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
                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === 'draft' && (
                          <Button size="sm" onClick={() => handlePublish(task.id)}>
                            发布
                          </Button>
                        )}
                        {task.status === 'published' && (
                          <Button size="sm" variant="outline" onClick={() => handleClose(task.id)}>
                            截止
                          </Button>
                        )}
                        {task.status === 'closed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePublish(task.id)}
                          >
                            重新发布
                          </Button>
                        )}
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
