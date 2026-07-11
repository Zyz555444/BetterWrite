'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api/fetcher';
import { clientLogger } from '@/lib/client-logger';
import type { SchoolWithStats } from '@betterwrite/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface SchoolFormState {
  code: string;
  name: string;
  region: string;
  contactName: string;
  contactPhone: string;
  isActive: boolean;
}

const EMPTY_FORM: SchoolFormState = {
  code: '',
  name: '',
  region: '',
  contactName: '',
  contactPhone: '',
  isActive: true,
};

interface SchoolsClientProps {
  initialSchools: SchoolWithStats[];
  initialRegion: string;
  initialError: string | null;
}

export function SchoolsClient({ initialSchools, initialRegion, initialError }: SchoolsClientProps) {
  const [schools, setSchools] = useState<SchoolWithStats[]>(initialSchools);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [regionFilter, setRegionFilter] = useState(initialRegion);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SchoolFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const latestRequestRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSchools = async (region: string) => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher.listAdminSchools(region ? { region } : undefined);
      if (requestId !== latestRequestRef.current) return;
      if (res.success && res.data) {
        setSchools(res.data);
      } else {
        setError(res.error ?? '加载失败');
      }
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      setError(err instanceof Error ? err.message : '加载失败');
      clientLogger.error('[AdminSchools] reload error', err);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: regionFilter is the only dep
  useEffect(() => {
    if (regionFilter === initialRegion) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadSchools(regionFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [regionFilter, initialRegion]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (school: SchoolWithStats) => {
    setForm({
      code: school.code,
      name: school.name,
      region: school.region,
      contactName: school.contactName ?? '',
      contactPhone: school.contactPhone ?? '',
      isActive: school.isActive,
    });
    setEditingId(school.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.code || !form.name || !form.region) {
      setError('学校代码、名称、所属区域不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        region: form.region,
        contactName: form.contactName || undefined,
        contactPhone: form.contactPhone || undefined,
      };
      if (editingId) {
        await fetcher.updateAdminSchool(editingId, { ...payload, isActive: form.isActive });
      } else {
        await fetcher.createAdminSchool(payload);
      }
      setModalOpen(false);
      await loadSchools(regionFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      clientLogger.error('[AdminSchools] save error', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认停用学校「${name}」？停用后该校用户将无法登录。`)) return;
    try {
      await fetcher.deleteAdminSchool(id);
      await loadSchools(regionFilter);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      clientLogger.error('[AdminSchools] delete error', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">学校管理</h1>
          <p className="text-copy-14 text-neutral-8 mt-1">管理学校信息、查看区域分布与使用统计</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          新建学校
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <span className="text-copy-14 text-neutral-8 whitespace-nowrap">区域筛选</span>
            <Input
              className="max-w-xs"
              placeholder="输入区域名称"
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
            />
            {regionFilter && (
              <Button variant="ghost" size="sm" onClick={() => setRegionFilter('')}>
                清除
              </Button>
            )}
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

      {!loading && schools.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-copy-14 text-neutral-8">暂无学校数据</p>
          </CardContent>
        </Card>
      )}

      {!loading && schools.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-copy-14">
                <thead className="bg-neutral-2 text-neutral-8">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">代码</th>
                    <th className="text-left px-4 py-3 font-medium">名称</th>
                    <th className="text-left px-4 py-3 font-medium">区域</th>
                    <th className="text-left px-4 py-3 font-medium">联系人</th>
                    <th className="text-right px-4 py-3 font-medium">教师</th>
                    <th className="text-right px-4 py-3 font-medium">学生</th>
                    <th className="text-right px-4 py-3 font-medium">班级</th>
                    <th className="text-right px-4 py-3 font-medium">作文</th>
                    <th className="text-right px-4 py-3 font-medium">平均分</th>
                    <th className="text-center px-4 py-3 font-medium">状态</th>
                    <th className="text-center px-4 py-3 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schools.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-2">
                      <td className="px-4 py-3 text-neutral-8">{s.code}</td>
                      <td className="px-4 py-3 text-neutral-10 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-neutral-8">{s.region}</td>
                      <td className="px-4 py-3 text-neutral-8">
                        {s.contactName ?? '-'}
                        {s.contactPhone ? ` (${s.contactPhone})` : ''}
                      </td>
                      <td className="px-4 py-3 text-right text-neutral-8">{s.totalTeachers}</td>
                      <td className="px-4 py-3 text-right text-neutral-8">{s.totalStudents}</td>
                      <td className="px-4 py-3 text-right text-neutral-8">{s.totalClasses}</td>
                      <td className="px-4 py-3 text-right text-neutral-8">{s.totalEssays}</td>
                      <td className="px-4 py-3 text-right text-neutral-8">
                        {s.averageScore ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={s.isActive ? 'default' : 'secondary'}>
                          {s.isActive ? '启用' : '停用'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(s)}
                            aria-label="编辑"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(s.id, s.name)}
                            aria-label="停用"
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-title-20 font-medium text-neutral-10">
                {editingId ? '编辑学校' : '新建学校'}
              </h2>
              <div className="space-y-3">
                <div>
                  <span className="text-label-12 text-neutral-8">学校代码 *</span>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    disabled={!!editingId}
                    placeholder="如 SZ001"
                  />
                </div>
                <div>
                  <span className="text-label-12 text-neutral-8">学校名称 *</span>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="如 深圳实验学校"
                  />
                </div>
                <div>
                  <span className="text-label-12 text-neutral-8">所属区域 *</span>
                  <Input
                    value={form.region}
                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                    placeholder="如 南山区"
                  />
                </div>
                <div>
                  <span className="text-label-12 text-neutral-8">联系人</span>
                  <Input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    placeholder="联系人姓名"
                  />
                </div>
                <div>
                  <span className="text-label-12 text-neutral-8">联系电话</span>
                  <Input
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    placeholder="联系电话"
                  />
                </div>
                {editingId && (
                  <span className="flex items-center gap-2 text-copy-14 text-neutral-8">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    启用状态
                  </span>
                )}
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
    </div>
  );
}
