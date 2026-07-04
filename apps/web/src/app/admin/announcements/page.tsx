'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api/fetcher';
import type { AnnouncementItem } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AnnouncementFormState {
  title: string;
  content: string;
  targetRole: string;
  isActive: boolean;
}

const EMPTY_FORM: AnnouncementFormState = {
  title: '',
  content: '',
  targetRole: 'all',
  isActive: true,
};

const ROLE_LABELS: Record<string, string> = {
  all: '所有人',
  teacher: '教师',
  student: '学生',
  school_admin: '学校管理员',
  super_admin: '超级管理员',
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AnnouncementFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher.listAdminAnnouncements();
      if (res.success && res.data) {
        setItems(res.data);
      } else {
        setError(res.error ?? '加载失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      console.error('[AdminAnnouncements] load error', err);
    } finally {
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (item: AnnouncementItem) => {
    setForm({
      title: item.title,
      content: item.content,
      targetRole: item.targetRole,
      isActive: item.isActive,
    });
    setEditingId(item.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.content) {
      setError('标题和内容不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        targetRole: form.targetRole,
        isActive: form.isActive,
      };
      if (editingId) {
        await fetcher.updateAdminAnnouncement(editingId, payload);
      } else {
        await fetcher.createAdminAnnouncement(payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      console.error('[AdminAnnouncements] save error', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确认删除公告「${title}」？此操作不可恢复。`)) return;
    try {
      await fetcher.deleteAdminAnnouncement(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      console.error('[AdminAnnouncements] delete error', err);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-title-24 font-serif font-medium text-neutral-10">公告管理</h1>
              <p className="text-copy-14 text-neutral-8 mt-1">发布、编辑与下线系统公告</p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />
              发布公告
            </Button>
          </div>

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
                <p className="text-copy-14 text-neutral-8">暂无公告</p>
              </CardContent>
            </Card>
          )}

          {!loading && items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title-20">公告列表</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-copy-14">
                    <thead className="bg-neutral-2 text-neutral-8">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">标题</th>
                        <th className="text-left px-4 py-3 font-medium">目标角色</th>
                        <th className="text-center px-4 py-3 font-medium">状态</th>
                        <th className="text-left px-4 py-3 font-medium">创建人</th>
                        <th className="text-left px-4 py-3 font-medium">创建时间</th>
                        <th className="text-center px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-neutral-2">
                          <td className="px-4 py-3 text-neutral-10 font-medium">{item.title}</td>
                          <td className="px-4 py-3 text-neutral-8">
                            {ROLE_LABELS[item.targetRole] ?? item.targetRole}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={item.isActive ? 'default' : 'secondary'}>
                              {item.isActive ? '生效' : '下线'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-neutral-8">{item.creatorName ?? '-'}</td>
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
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-title-20 font-medium text-neutral-10">
                  {editingId ? '编辑公告' : '发布公告'}
                </h2>
                <div className="space-y-3">
                  <div>
                    <span className="text-label-12 text-neutral-8">标题 *</span>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="公告标题"
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">内容 *</span>
                    <textarea
                      className="flex w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border min-h-[160px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      placeholder="公告正文"
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">目标角色</span>
                    <select
                      className="flex h-10 w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                      value={form.targetRole}
                      onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                    >
                      <option value="all">所有人</option>
                      <option value="teacher">教师</option>
                      <option value="student">学生</option>
                      <option value="school_admin">学校管理员</option>
                      <option value="super_admin">超级管理员</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-copy-14 text-neutral-8">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    立即生效
                  </label>
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
