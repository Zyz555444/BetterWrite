'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { type TeachingResourceWithCreator, fetcher } from '@/lib/api/fetcher';
import {
  TeachingResourceDifficultyLabels,
  TeachingResourceTypeLabels,
  TopicTypeLabels,
  UserRole,
} from '@betterwrite/shared';
import { ChevronDown, ChevronUp, Edit, Eye, Plus, Search, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const resourceTypeIcons: Record<string, string> = {
  sample: '📚',
  sentence: '✏️',
  connector: '🔗',
  errorcase: '⚠️',
};

const difficultyColors: Record<string, string> = {
  easy: 'bg-success/10 text-success',
  medium: 'bg-warning/10 text-warning',
  hard: 'bg-error/10 text-error',
};

interface ResourceForm {
  title: string;
  topicType: string;
  difficulty: string;
  content: string;
  highlights: string;
  tags: string;
}

const emptyForm: ResourceForm = {
  title: '',
  topicType: '',
  difficulty: 'medium',
  content: '',
  highlights: '',
  tags: '',
};

export default function TeacherResourcesListPage() {
  const params = useParams();
  const type = (params.type as string) ?? '';

  const [list, setList] = useState<TeachingResourceWithCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [topicTypeFilter, setTopicTypeFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<ResourceForm>(emptyForm);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const typeLabel =
    TeachingResourceTypeLabels[type as keyof typeof TeachingResourceTypeLabels] ?? type;
  const typeIcon = resourceTypeIcons[type] ?? '📄';

  const loadList = async () => {
    if (!type) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: { type: string; topicType?: string; difficulty?: string } = { type };
      if (topicTypeFilter !== 'all') params.topicType = topicTypeFilter;
      if (difficultyFilter !== 'all') params.difficulty = difficultyFilter;
      console.log(`[TeacherResourcesList] loading type=${type}`, params);
      const res = await fetcher.listResources(params);
      if (res.success && res.data) {
        console.log(`[TeacherResourcesList] loaded ${res.data.length} resources`);
        setList(res.data);
      } else {
        console.warn('[TeacherResourcesList] failed to load:', res.error);
        setError(res.error ?? '获取资源列表失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[TeacherResourcesList] load error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: loadList 内部依赖 topicTypeFilter/difficultyFilter
  useEffect(() => {
    console.log(`[TeacherResourcesList] page mounted type=${type}`);
    if (!type) {
      setError('缺少资源类型参数');
      setIsLoading(false);
      return;
    }
    loadList();
  }, [type, topicTypeFilter, difficultyFilter]);

  const filteredList = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return list;
    const result = list.filter((item) => {
      return (
        item.title.toLowerCase().includes(keyword) ||
        (item.content ?? '').toLowerCase().includes(keyword) ||
        (item.tags ?? []).some((t) => t.toLowerCase().includes(keyword))
      );
    });
    console.log(`[TeacherResourcesList] search="${search}" result=${result.length}/${list.length}`);
    return result;
  }, [list, search]);

  const handleOpenCreate = () => {
    console.log(`[TeacherResourcesList] create clicked type=${type}`);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setShowFormModal(true);
  };

  const handleOpenEdit = (resource: TeachingResourceWithCreator) => {
    console.log(`[TeacherResourcesList] edit id=${resource.id}`);
    setEditingId(resource.id);
    setForm({
      title: resource.title ?? '',
      topicType: resource.topicType ?? '',
      difficulty: resource.difficulty ?? 'medium',
      content: resource.content ?? '',
      highlights: resource.highlights ?? '',
      tags: (resource.tags ?? []).join(', '),
    });
    setFormError(null);
    setShowFormModal(true);
  };

  const handleCloseForm = () => {
    console.log('[TeacherResourcesList] close form modal');
    setShowFormModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim() || !form.content.trim()) {
      const msg = '请填写标题和正文内容';
      console.warn('[TeacherResourcesList] submit validation failed:', msg);
      setFormError(msg);
      return;
    }

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      type,
      title: form.title.trim(),
      topicType: form.topicType || undefined,
      difficulty: form.difficulty,
      content: form.content,
      highlights: form.highlights,
      tags,
    };

    console.log(
      `[TeacherResourcesList] submitting ${editingId ? 'update' : 'create'} id=${editingId ?? '-'}`,
    );
    setIsSubmitting(true);
    try {
      if (editingId) {
        const res = await fetcher.updateResource(editingId, {
          title: payload.title,
          topicType: payload.topicType,
          difficulty: payload.difficulty,
          content: payload.content,
          highlights: payload.highlights,
          tags: payload.tags,
        });
        if (res.success && res.data) {
          const updated = res.data;
          console.log(`[TeacherResourcesList] updated id=${updated.id}`);
          setList((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
          handleCloseForm();
        } else {
          console.warn('[TeacherResourcesList] update failed:', res.error);
          if (
            res.error?.includes('409') ||
            res.error?.includes('冲突') ||
            res.error?.includes('已存在')
          ) {
            setFormError('该类型下已存在同名资源');
          } else {
            setFormError(res.error ?? '更新失败');
          }
        }
      } else {
        const res = await fetcher.createResource(payload);
        if (res.success && res.data) {
          const created = res.data;
          console.log(`[TeacherResourcesList] created id=${created.id}`);
          setList((prev) => [created, ...prev]);
          handleCloseForm();
        } else {
          console.warn('[TeacherResourcesList] create failed:', res.error);
          if (
            res.error?.includes('409') ||
            res.error?.includes('冲突') ||
            res.error?.includes('已存在')
          ) {
            setFormError('该类型下已存在同名资源');
          } else {
            setFormError(res.error ?? '创建失败');
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '操作失败';
      console.error('[TeacherResourcesList] submit error:', message);
      if (message.includes('409') || message.includes('冲突') || message.includes('已存在')) {
        setFormError('该类型下已存在同名资源');
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleExpand = (id: string) => {
    console.log(`[TeacherResourcesList] toggle expand id=${id}`);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAskDelete = (id: string) => {
    console.log(`[TeacherResourcesList] ask delete id=${id}`);
    setShowDeleteConfirm(id);
  };

  const handleCancelDelete = () => {
    console.log('[TeacherResourcesList] cancel delete');
    setShowDeleteConfirm(null);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm) return;
    const id = showDeleteConfirm;
    console.log(`[TeacherResourcesList] delete id=${id}`);
    setIsDeleting(true);
    try {
      const res = await fetcher.deleteResource(id);
      if (res.success) {
        console.log(`[TeacherResourcesList] deleted id=${id}`);
        setList((prev) => prev.filter((item) => item.id !== id));
        if (expandedId === id) setExpandedId(null);
        setShowDeleteConfirm(null);
      } else {
        console.warn('[TeacherResourcesList] delete failed:', res.error);
        setError(res.error ?? '删除失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '删除失败';
      console.error('[TeacherResourcesList] delete error:', message);
      setError(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (!type) {
    return (
      <RoleGuard allowedRoles={[UserRole.TEACHER]}>
        <DashboardLayout>
          <div className="space-y-4">
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">教学资源</h1>
            <p className="text-error text-copy-14">缺少资源类型参数</p>
          </div>
        </DashboardLayout>
      </RoleGuard>
    );
  }

  return (
    <RoleGuard allowedRoles={[UserRole.TEACHER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-title-24 font-serif font-medium text-neutral-10 flex items-center gap-2">
                <span aria-hidden>{typeIcon}</span>
                {typeLabel}
              </h1>
              <p className="text-copy-14 text-neutral-8 mt-1">
                管理当前类型的教学资源，支持筛选、搜索与增删改
              </p>
            </div>
            <Button type="button" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4 mr-2" />
              新增资源
            </Button>
          </div>

          {error && (
            <div className="flex items-center justify-between p-3 rounded-md bg-error/10 border border-error/20">
              <p className="text-copy-14 text-error">{error}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  loadList();
                }}
              >
                重试
              </Button>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">筛选与搜索</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="topicTypeFilter"
                    className="text-copy-14 font-medium text-neutral-10"
                  >
                    体裁
                  </label>
                  <select
                    id="topicTypeFilter"
                    value={topicTypeFilter}
                    onChange={(e) => {
                      console.log(`[TeacherResourcesList] topicType filter=${e.target.value}`);
                      setTopicTypeFilter(e.target.value);
                    }}
                    className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                  >
                    <option value="all">全部体裁</option>
                    {Object.entries(TopicTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="difficultyFilter"
                    className="text-copy-14 font-medium text-neutral-10"
                  >
                    难度
                  </label>
                  <select
                    id="difficultyFilter"
                    value={difficultyFilter}
                    onChange={(e) => {
                      console.log(`[TeacherResourcesList] difficulty filter=${e.target.value}`);
                      setDifficultyFilter(e.target.value);
                    }}
                    className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                  >
                    <option value="all">全部难度</option>
                    {Object.entries(TeachingResourceDifficultyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="search" className="text-copy-14 font-medium text-neutral-10">
                    搜索
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-7" />
                    <Input
                      id="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="标题、正文或标签"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">
                资源列表
                <span className="ml-2 text-neutral-8 text-copy-14 font-normal">
                  共 {filteredList.length} 条
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-neutral-8 text-copy-14">加载中...</p>
              ) : filteredList.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-neutral-8 text-copy-14">暂无资源，点击右上角新增</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-3"
                    onClick={handleOpenCreate}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    新增资源
                  </Button>
                </div>
              ) : (
                <ul className="space-y-3">
                  {filteredList.map((resource) => {
                    const isExpanded = expandedId === resource.id;
                    return (
                      <li
                        key={resource.id}
                        className="border border-border rounded-md bg-neutral-2 overflow-hidden"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="font-medium text-neutral-10 truncate">
                                {resource.title}
                              </p>
                              {resource.topicType && (
                                <Badge variant="secondary">
                                  {TopicTypeLabels[
                                    resource.topicType as keyof typeof TopicTypeLabels
                                  ] ?? resource.topicType}
                                </Badge>
                              )}
                              {resource.difficulty && (
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-label-12 font-medium ${
                                    difficultyColors[resource.difficulty] ?? ''
                                  }`}
                                >
                                  {TeachingResourceDifficultyLabels[
                                    resource.difficulty as keyof typeof TeachingResourceDifficultyLabels
                                  ] ?? resource.difficulty}
                                </span>
                              )}
                              {(resource.tags ?? []).slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline">
                                  #{tag}
                                </Badge>
                              ))}
                              {(resource.tags ?? []).length > 3 && (
                                <span className="text-label-12 text-neutral-7">
                                  +{resource.tags.length - 3}
                                </span>
                              )}
                            </div>
                            <p className="text-label-12 text-neutral-8 flex items-center gap-2 flex-wrap">
                              <span>
                                创建者：{resource.creator?.name ?? resource.createdBy ?? '-'}
                              </span>
                              <span>·</span>
                              <span>{formatDate(resource.createdAt)}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleExpand(resource.id)}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 mr-1" />
                              ) : (
                                <ChevronDown className="w-4 h-4 mr-1" />
                              )}
                              <Eye className="w-3 h-3" />
                              查看
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(resource)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAskDelete(resource.id)}
                              className="text-error hover:bg-error/10"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              删除
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-border bg-paper p-4 space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-copy-14">
                              <div>
                                <span className="text-neutral-7">体裁：</span>
                                <span className="text-neutral-10">
                                  {resource.topicType
                                    ? (TopicTypeLabels[
                                        resource.topicType as keyof typeof TopicTypeLabels
                                      ] ?? resource.topicType)
                                    : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-7">难度：</span>
                                <span className="text-neutral-10">
                                  {resource.difficulty
                                    ? (TeachingResourceDifficultyLabels[
                                        resource.difficulty as keyof typeof TeachingResourceDifficultyLabels
                                      ] ?? resource.difficulty)
                                    : '-'}
                                </span>
                              </div>
                              <div>
                                <span className="text-neutral-7">创建时间：</span>
                                <span className="text-neutral-10">
                                  {formatDate(resource.createdAt)}
                                </span>
                              </div>
                            </div>

                            <div>
                              <p className="text-label-12 font-medium text-neutral-7 mb-1">
                                正文内容
                              </p>
                              <div className="whitespace-pre-wrap text-copy-14 text-neutral-10 bg-neutral-2 rounded-md p-3 border border-border">
                                {resource.content || '（无）'}
                              </div>
                            </div>

                            {resource.highlights && (
                              <div>
                                <p className="text-label-12 font-medium text-neutral-7 mb-1">
                                  亮点点评
                                </p>
                                <div className="whitespace-pre-wrap text-copy-14 text-neutral-10 bg-neutral-2 rounded-md p-3 border border-border">
                                  {resource.highlights}
                                </div>
                              </div>
                            )}

                            {(resource.tags ?? []).length > 0 && (
                              <div>
                                <p className="text-label-12 font-medium text-neutral-7 mb-1">
                                  标签
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {resource.tags.map((tag) => (
                                    <Badge key={tag} variant="outline">
                                      #{tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="text-label-12 text-neutral-7">
                              创建者：{resource.creator?.name ?? resource.createdBy ?? '-'} ·
                              更新时间：{formatDate(resource.updatedAt)}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-paper rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-title-20 font-serif font-medium text-neutral-10 flex items-center gap-2">
                  <span aria-hidden>{typeIcon}</span>
                  {editingId ? '编辑资源' : '新增资源'} · {typeLabel}
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleCloseForm}
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {formError && (
                <div className="mb-4 p-3 rounded-md bg-error/10 border border-error/20">
                  <p className="text-copy-14 text-error">{formError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-copy-14 font-medium text-neutral-10">
                    标题 <span className="text-error">*</span>
                  </label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="资源标题"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="topicType" className="text-copy-14 font-medium text-neutral-10">
                      体裁（可选）
                    </label>
                    <select
                      id="topicType"
                      value={form.topicType}
                      onChange={(e) => setForm((prev) => ({ ...prev, topicType: e.target.value }))}
                      className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    >
                      <option value="">不限体裁</option>
                      {Object.entries(TopicTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="difficulty"
                      className="text-copy-14 font-medium text-neutral-10"
                    >
                      难度
                    </label>
                    <select
                      id="difficulty"
                      value={form.difficulty}
                      onChange={(e) => setForm((prev) => ({ ...prev, difficulty: e.target.value }))}
                      className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    >
                      {Object.entries(TeachingResourceDifficultyLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="content" className="text-copy-14 font-medium text-neutral-10">
                    正文内容 <span className="text-error">*</span>
                  </label>
                  <textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="范文正文 / 句型模板 / 连接词列表 / 错误案例..."
                    className="w-full min-h-[160px] px-3 py-2 rounded-md bg-paper text-neutral-10 text-copy-14 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="highlights" className="text-copy-14 font-medium text-neutral-10">
                    亮点点评
                  </label>
                  <textarea
                    id="highlights"
                    value={form.highlights}
                    onChange={(e) => setForm((prev) => ({ ...prev, highlights: e.target.value }))}
                    placeholder="对该资源的亮点、用法或教学建议..."
                    className="w-full min-h-[80px] px-3 py-2 rounded-md bg-paper text-neutral-10 text-copy-14 ring-1 ring-border placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="tags" className="text-copy-14 font-medium text-neutral-10">
                    标签（逗号分隔）
                  </label>
                  <Input
                    id="tags"
                    value={form.tags}
                    onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="例如：开头句, 高分, 议论文"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={handleCloseForm}>
                    取消
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? '保存中...' : editingId ? '保存修改' : '创建资源'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-paper rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-title-20 font-serif font-medium text-neutral-10 mb-2">
                确认删除
              </h3>
              <p className="text-copy-14 text-neutral-8 mb-4">
                删除后不可恢复，确定要删除该资源吗？
              </p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={handleCancelDelete}>
                  取消
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? '删除中...' : '确认删除'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </RoleGuard>
  );
}
