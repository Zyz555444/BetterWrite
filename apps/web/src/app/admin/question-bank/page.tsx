'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api/fetcher';
import type { QuestionBankItem } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface QuestionFormState {
  topicType: string;
  topicCategory: string;
  title: string;
  requirements: string;
  keyPointsText: string;
  referenceEssay: string;
  wordLimitMin: number;
  wordLimitMax: number;
  timeLimitMinutes: number;
  difficulty: string;
  source: string;
}

const EMPTY_FORM: QuestionFormState = {
  topicType: 'argumentative',
  topicCategory: '',
  title: '',
  requirements: '',
  keyPointsText: '',
  referenceEssay: '',
  wordLimitMin: 80,
  wordLimitMax: 125,
  timeLimitMinutes: 15,
  difficulty: 'medium',
  source: '',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export default function AdminQuestionBankPage() {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topicTypeFilter, setTopicTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuestionFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher.listAdminQuestionBank({
        topicType: topicTypeFilter || undefined,
        difficulty: difficultyFilter || undefined,
        limit: 100,
      });
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setError(res.error ?? '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      console.error('[AdminQuestionBank] load error', err);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    load();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: filters are the only deps
  useEffect(() => {
    load();
  }, [topicTypeFilter, difficultyFilter]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (item: QuestionBankItem) => {
    setForm({
      topicType: item.topicType,
      topicCategory: item.topicCategory ?? '',
      title: item.title,
      requirements: item.requirements,
      keyPointsText: item.keyPoints.join('\n'),
      referenceEssay: item.referenceEssay ?? '',
      wordLimitMin: item.wordLimitMin,
      wordLimitMax: item.wordLimitMax,
      timeLimitMinutes: item.timeLimitMinutes ?? 15,
      difficulty: item.difficulty,
      source: item.source ?? '',
    });
    setEditingId(item.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.topicType || !form.title || !form.requirements) {
      setError('题目类型、标题、要求不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const keyPoints = form.keyPointsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        topicType: form.topicType,
        topicCategory: form.topicCategory || undefined,
        title: form.title,
        requirements: form.requirements,
        keyPoints,
        referenceEssay: form.referenceEssay || undefined,
        wordLimitMin: form.wordLimitMin,
        wordLimitMax: form.wordLimitMax,
        timeLimitMinutes: form.timeLimitMinutes,
        difficulty: form.difficulty,
        source: form.source || undefined,
      };
      if (editingId) {
        await fetcher.updateAdminQuestion(editingId, payload);
      } else {
        await fetcher.createAdminQuestion(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      console.error('[AdminQuestionBank] save error', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确认删除题目「${title}」？此操作不可恢复。`)) return;
    try {
      await fetcher.deleteAdminQuestion(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      console.error('[AdminQuestionBank] delete error', err);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-title-24 font-serif font-medium text-neutral-10">题库管理</h1>
              <p className="text-copy-14 text-neutral-8 mt-1">管理写作题库，支持按类型与难度筛选</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              新增题目
            </Button>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-neutral-8 whitespace-nowrap">题目类型</span>
                  <select
                    className="flex h-10 rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                    value={topicTypeFilter}
                    onChange={(e) => setTopicTypeFilter(e.target.value)}
                  >
                    <option value="">全部</option>
                    <option value="argumentative">议论文</option>
                    <option value="narrative">记叙文</option>
                    <option value="descriptive">描写文</option>
                    <option value="practical">应用文</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-neutral-8 whitespace-nowrap">难度</span>
                  <select
                    className="flex h-10 rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                    value={difficultyFilter}
                    onChange={(e) => setDifficultyFilter(e.target.value)}
                  >
                    <option value="">全部</option>
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                </div>
                <Button variant="ghost" size="sm" onClick={load}>
                  <Search className="w-3 h-3 mr-1" />
                  刷新
                </Button>
              </div>
            </CardContent>
          </Card>

          {error && (
            <Card>
              <CardContent className="p-4">
                <p className="text-copy-14 text-error">{error}</p>
              </CardContent>
            </Card>
          )}

          {loading && <p className="text-copy-14 text-neutral-8">加载中...</p>}

          {!loading && items.length === 0 && !error && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-copy-14 text-neutral-8">暂无题目</p>
              </CardContent>
            </Card>
          )}

          {!loading && items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title-20">题目列表</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-copy-14">
                    <thead className="bg-neutral-2 text-neutral-8">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">类型</th>
                        <th className="text-left px-4 py-3 font-medium">分类</th>
                        <th className="text-left px-4 py-3 font-medium">标题</th>
                        <th className="text-center px-4 py-3 font-medium">难度</th>
                        <th className="text-right px-4 py-3 font-medium">字数范围</th>
                        <th className="text-right px-4 py-3 font-medium">时长(分)</th>
                        <th className="text-left px-4 py-3 font-medium">来源</th>
                        <th className="text-left px-4 py-3 font-medium">创建时间</th>
                        <th className="text-center px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-2">
                          <td className="px-4 py-3 text-neutral-8">{item.topicType}</td>
                          <td className="px-4 py-3 text-neutral-8">{item.topicCategory ?? '-'}</td>
                          <td className="px-4 py-3 text-neutral-10 font-medium">{item.title}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge
                              variant={
                                item.difficulty === 'hard'
                                  ? 'destructive'
                                  : item.difficulty === 'easy'
                                    ? 'secondary'
                                    : 'default'
                              }
                            >
                              {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-8">
                            {item.wordLimitMin}-{item.wordLimitMax}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-8">
                            {item.timeLimitMinutes ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-neutral-8 text-label-12">
                            {item.source ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-neutral-8 text-label-12">
                            {item.createdAt}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(item)}
                                aria-label="编辑"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(item.id, item.title)}
                                aria-label="删除"
                              >
                                <Trash2 className="w-4 h-4 text-error" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-title-20 font-medium text-neutral-10">
                  {editingId ? '编辑题目' : '新增题目'}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-label-12 text-neutral-8">题目类型 *</span>
                    <select
                      className="flex h-10 w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                      value={form.topicType}
                      onChange={(e) => setForm({ ...form, topicType: e.target.value })}
                    >
                      <option value="argumentative">议论文</option>
                      <option value="narrative">记叙文</option>
                      <option value="descriptive">描写文</option>
                      <option value="practical">应用文</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">分类</span>
                    <Input
                      value={form.topicCategory}
                      onChange={(e) => setForm({ ...form, topicCategory: e.target.value })}
                      placeholder="如 校园生活"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-label-12 text-neutral-8">标题 *</span>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="题目标题"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-label-12 text-neutral-8">写作要求 *</span>
                    <textarea
                      className="flex w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border min-h-[100px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      value={form.requirements}
                      onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                      placeholder="详细写作要求"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-label-12 text-neutral-8">要点（每行一个）</span>
                    <textarea
                      className="flex w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      value={form.keyPointsText}
                      onChange={(e) => setForm({ ...form, keyPointsText: e.target.value })}
                      placeholder="每行一个要点"
                    />
                  </div>
                  <div className="col-span-2">
                    <span className="text-label-12 text-neutral-8">参考范文</span>
                    <textarea
                      className="flex w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      value={form.referenceEssay}
                      onChange={(e) => setForm({ ...form, referenceEssay: e.target.value })}
                      placeholder="参考范文（可选）"
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">最小字数</span>
                    <Input
                      type="number"
                      value={form.wordLimitMin}
                      onChange={(e) => setForm({ ...form, wordLimitMin: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">最大字数</span>
                    <Input
                      type="number"
                      value={form.wordLimitMax}
                      onChange={(e) => setForm({ ...form, wordLimitMax: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">建议时长(分钟)</span>
                    <Input
                      type="number"
                      value={form.timeLimitMinutes}
                      onChange={(e) =>
                        setForm({ ...form, timeLimitMinutes: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">难度</span>
                    <select
                      className="flex h-10 w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                      value={form.difficulty}
                      onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    >
                      <option value="easy">简单</option>
                      <option value="medium">中等</option>
                      <option value="hard">困难</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <span className="text-label-12 text-neutral-8">来源</span>
                    <Input
                      value={form.source}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      placeholder="如 2024 深圳中考"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={() => setModalOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? '保存中...' : '保存'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DashboardLayout>
    </RoleGuard>
  );
}
