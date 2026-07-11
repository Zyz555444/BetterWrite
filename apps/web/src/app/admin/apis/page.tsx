'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api/fetcher';
import { clientLogger } from '@/lib/client-logger';
import type { ApiCallLogItem, ApiConfigItem } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface ConfigFormState {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  isActive: boolean;
  priority: number;
  maxTokens: number;
  temperature: number;
  rateLimitPerMin: number;
}

const EMPTY_CONFIG: ConfigFormState = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
  isActive: true,
  priority: 0,
  maxTokens: 4096,
  temperature: 0.3,
  rateLimitPerMin: 60,
};

export default function AdminApisPage() {
  const [configs, setConfigs] = useState<ApiConfigItem[]>([]);
  const [logs, setLogs] = useState<ApiCallLogItem[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConfigFormState>(EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [logProvider, setLogProvider] = useState('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');

  const loadConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const res = await fetcher.listAdminApiConfigs();
      if (res.success && res.data) {
        setConfigs(res.data);
      } else {
        setError(res.error ?? '加载配置失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载配置失败');
      clientLogger.error('[AdminApis] load configs error', err);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetcher.listAdminApiLogs({
        provider: logProvider || undefined,
        dateFrom: logDateFrom || undefined,
        dateTo: logDateTo || undefined,
        limit: 100,
      });
      if (res.success && res.data) {
        setLogs(res.data);
      }
    } catch (err) {
      clientLogger.error('[AdminApis] load logs error', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    loadConfigs();
    loadLogs();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: filters are the only deps
  useEffect(() => {
    loadLogs();
  }, [logProvider, logDateFrom, logDateTo]);

  const openCreate = () => {
    setForm(EMPTY_CONFIG);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (config: ApiConfigItem) => {
    setForm({
      provider: config.provider,
      apiKey: '',
      baseUrl: config.baseUrl ?? '',
      model: config.model ?? '',
      isActive: config.isActive,
      priority: config.priority,
      maxTokens: config.maxTokens ?? 4096,
      temperature: config.temperature ?? 0.3,
      rateLimitPerMin: config.rateLimitPerMin ?? 60,
    });
    setEditingId(config.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.provider || (!editingId && !form.apiKey)) {
      setError('provider 和 apiKey 不能为空');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        provider: form.provider,
        ...(form.apiKey && { apiKey: form.apiKey }),
        baseUrl: form.baseUrl || undefined,
        model: form.model || undefined,
        isActive: form.isActive,
        priority: form.priority,
        maxTokens: form.maxTokens,
        temperature: form.temperature,
        rateLimitPerMin: form.rateLimitPerMin,
      };
      if (editingId) {
        await fetcher.updateAdminApiConfig(editingId, payload);
      } else {
        await fetcher.createAdminApiConfig({ ...payload, apiKey: form.apiKey });
      }
      setModalOpen(false);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
      clientLogger.error('[AdminApis] save error', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, provider: string) => {
    if (!confirm(`确认删除 API 配置「${provider}」？此操作不可恢复。`)) return;
    try {
      await fetcher.deleteAdminApiConfig(id);
      await loadConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
      clientLogger.error('[AdminApis] delete error', err);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-title-24 font-serif font-medium text-neutral-10">API 管理</h1>
            <p className="text-copy-14 text-neutral-8 mt-1">多 Provider 配置、Key 管理与调用日志</p>
          </div>

          {error && (
            <Card>
              <CardContent className="p-4">
                <p className="text-copy-14 text-error">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* API Configs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-title-20">API 配置</CardTitle>
                <Button size="sm" onClick={openCreate}>
                  <Plus className="w-4 h-4 mr-1" />
                  新增配置
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingConfigs ? (
                <p className="text-copy-14 text-neutral-8 p-4">加载中...</p>
              ) : configs.length === 0 ? (
                <p className="text-copy-14 text-neutral-8 p-4">暂无 API 配置</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-copy-14">
                    <thead className="bg-neutral-2 text-neutral-8">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium">Provider</th>
                        <th className="text-left px-4 py-3 font-medium">Model</th>
                        <th className="text-left px-4 py-3 font-medium">API Key</th>
                        <th className="text-left px-4 py-3 font-medium">Base URL</th>
                        <th className="text-right px-4 py-3 font-medium">优先级</th>
                        <th className="text-right px-4 py-3 font-medium">maxTokens</th>
                        <th className="text-right px-4 py-3 font-medium">temperature</th>
                        <th className="text-center px-4 py-3 font-medium">状态</th>
                        <th className="text-center px-4 py-3 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {configs.map((c) => (
                        <tr key={c.id} className="hover:bg-neutral-2">
                          <td className="px-4 py-3 text-neutral-10 font-medium">{c.provider}</td>
                          <td className="px-4 py-3 text-neutral-8">{c.model ?? '-'}</td>
                          <td className="px-4 py-3 text-neutral-8 font-mono text-label-12">
                            {c.apiKeyMasked}
                          </td>
                          <td className="px-4 py-3 text-neutral-8 text-label-12">
                            {c.baseUrl ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-8">{c.priority}</td>
                          <td className="px-4 py-3 text-right text-neutral-8">
                            {c.maxTokens ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-neutral-8">
                            {c.temperature ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant={c.isActive ? 'default' : 'secondary'}>
                              {c.isActive ? '启用' : '停用'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(c)}
                                aria-label="编辑"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(c.id, c.provider)}
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
              )}
            </CardContent>
          </Card>

          {/* API Logs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-title-20">API 调用日志</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-neutral-8 whitespace-nowrap">Provider</span>
                  <Input
                    className="max-w-[160px]"
                    placeholder="如 openai"
                    value={logProvider}
                    onChange={(e) => setLogProvider(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-neutral-8 whitespace-nowrap">起始日期</span>
                  <Input
                    type="date"
                    className="max-w-[160px]"
                    value={logDateFrom}
                    onChange={(e) => setLogDateFrom(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label-12 text-neutral-8 whitespace-nowrap">截止日期</span>
                  <Input
                    type="date"
                    className="max-w-[160px]"
                    value={logDateTo}
                    onChange={(e) => setLogDateTo(e.target.value)}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={loadLogs}>
                  <Search className="w-3 h-3 mr-1" />
                  刷新
                </Button>
              </div>

              {loadingLogs ? (
                <p className="text-copy-14 text-neutral-8">加载中...</p>
              ) : logs.length === 0 ? (
                <p className="text-copy-14 text-neutral-8">暂无调用日志</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-copy-14">
                    <thead className="bg-neutral-2 text-neutral-8">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">时间</th>
                        <th className="text-left px-3 py-2 font-medium">Provider</th>
                        <th className="text-left px-3 py-2 font-medium">Model</th>
                        <th className="text-left px-3 py-2 font-medium">Endpoint</th>
                        <th className="text-right px-3 py-2 font-medium">Tokens</th>
                        <th className="text-right px-3 py-2 font-medium">延迟(ms)</th>
                        <th className="text-right px-3 py-2 font-medium">费用</th>
                        <th className="text-center px-3 py-2 font-medium">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {logs.map((l) => (
                        <tr key={l.id} className="hover:bg-neutral-2">
                          <td className="px-3 py-2 text-neutral-8 text-label-12">{l.createdAt}</td>
                          <td className="px-3 py-2 text-neutral-10 font-medium">{l.provider}</td>
                          <td className="px-3 py-2 text-neutral-8 text-label-12">
                            {l.model ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-neutral-8 text-label-12">
                            {l.endpoint ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-8">
                            {l.tokensUsed ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-8">
                            {l.latencyMs ?? '-'}
                          </td>
                          <td className="px-3 py-2 text-right text-neutral-8">
                            {l.cost != null ? `$${l.cost.toFixed(4)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant={
                                l.status === 'success'
                                  ? 'default'
                                  : l.status === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                            >
                              {l.status ?? '-'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-title-20 font-medium text-neutral-10">
                  {editingId ? '编辑 API 配置' : '新增 API 配置'}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-label-12 text-neutral-8">Provider *</span>
                    <select
                      className="flex h-10 w-full rounded-md bg-paper px-3 py-2 text-copy-14 text-neutral-10 ring-1 ring-border"
                      value={form.provider}
                      onChange={(e) => setForm({ ...form, provider: e.target.value })}
                    >
                      <option value="openai">openai</option>
                      <option value="deepseek">deepseek</option>
                      <option value="anthropic">anthropic</option>
                      <option value="qwen">qwen</option>
                      <option value="other">other</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">
                      API Key {editingId ? '(留空保留原值)' : '*'}
                    </span>
                    <Input
                      type="password"
                      value={form.apiKey}
                      onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                      placeholder={editingId ? '留空则不修改' : '输入 API Key'}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">Base URL</span>
                    <Input
                      value={form.baseUrl}
                      onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                      placeholder="如 https://api.openai.com/v1"
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">Model</span>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                      placeholder="如 gpt-4o-mini"
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">优先级</span>
                    <Input
                      type="number"
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">maxTokens</span>
                    <Input
                      type="number"
                      value={form.maxTokens}
                      onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">temperature</span>
                    <Input
                      type="number"
                      step="0.1"
                      value={form.temperature}
                      onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <span className="text-label-12 text-neutral-8">rateLimitPerMin</span>
                    <Input
                      type="number"
                      value={form.rateLimitPerMin}
                      onChange={(e) =>
                        setForm({ ...form, rateLimitPerMin: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-copy-14 text-neutral-8">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  启用状态
                </label>
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
