'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { AiAssistantPanel } from '@/components/student/ai-assistant-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { clientLogger } from '@/lib/client-logger';
import { type AiAssistantResult, type AiConversation, UserRole } from '@betterwrite/shared';
import { ChevronDown, ChevronRight, History } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Mode = 'polish' | 'upgrade' | 'synonym' | 'grammar';

interface ModeConfig {
  title: string;
  description: string;
  placeholder: string;
}

const modeConfigs: Record<Mode, ModeConfig> = {
  polish: {
    title: 'AI 润色',
    description: '优化表达，不改变原意',
    placeholder: '粘贴你的英文段落...',
  },
  upgrade: {
    title: '句型升级',
    description: '将简单句升级为高级句式',
    placeholder: '粘贴需要升级的句子...',
  },
  synonym: {
    title: '同义词推荐',
    description: '替换基础词汇为高级词汇',
    placeholder: '输入单词，可加上下文，如：important | It is important to...',
  },
  grammar: {
    title: '语法检查',
    description: '检查语法错误并给出修改建议',
    placeholder: '粘贴需要检查的英文...',
  },
};

const modeLabels: Record<Mode, string> = {
  polish: '润色',
  upgrade: '句型升级',
  synonym: '同义词',
  grammar: '语法检查',
};

const modeOrder: Mode[] = ['polish', 'upgrade', 'synonym', 'grammar'];

interface DetailRow {
  label: string;
  value: string;
}

interface AiResponse {
  success: boolean;
  data?: AiAssistantResult;
  error?: string;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function isAiNotConfigured(message: string | null): boolean {
  return message?.includes('未配置') ?? false;
}

function toDetailRows(mode: Mode, details: Record<string, unknown>): DetailRow[] {
  if (mode === 'polish') {
    const changes = details.changes as
      | Array<{ original: string; revised: string; reason: string }>
      | undefined;
    if (!changes) return [];
    return changes.map((c, i) => ({
      label: `修改 ${i + 1}`,
      value: `${c.original} → ${c.revised}: ${c.reason}`,
    }));
  }
  if (mode === 'grammar') {
    const errors = details.errors as
      | Array<{ original: string; corrected: string; type: string; explanation: string }>
      | undefined;
    if (!errors) return [];
    return errors.map((e, i) => ({
      label: `错误 ${i + 1} (${e.type})`,
      value: `${e.original} → ${e.corrected}: ${e.explanation}`,
    }));
  }
  if (mode === 'upgrade') {
    const sentences = details.sentences as
      | Array<{ original: string; upgraded: string; technique: string }>
      | undefined;
    if (!sentences) return [];
    return sentences.map((s, i) => ({
      label: `句子 ${i + 1} (${s.technique})`,
      value: `${s.original} → ${s.upgraded}`,
    }));
  }
  const synonyms = details.synonyms as
    | Array<{ word: string; level: string; example: string }>
    | undefined;
  if (!synonyms) return [];
  return synonyms.map((s) => ({
    label: `${s.word} (${s.level})`,
    value: s.example,
  }));
}

export default function StudentAiAssistantPage() {
  const [mode, setMode] = useState<Mode>('polish');
  const [result, setResult] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AiConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    fetcher
      .getAiHistory({ limit: 10 })
      .then((res) => {
        if (res.success && res.data) {
          setHistory(res.data);
        } else {
          setHistoryError(res.error ?? '获取历史记录失败');
          clientLogger.warn(`[StudentAiAssistant] 历史加载失败 error=${res.error ?? 'unknown'}`);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '获取历史记录失败';
        setHistoryError(msg);
        clientLogger.warn(`[StudentAiAssistant] 历史加载异常 error=${msg}`);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async (input: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setDetails([]);
    try {
      let res: AiResponse;
      if (mode === 'polish') {
        res = await fetcher.aiPolish(input);
      } else if (mode === 'upgrade') {
        res = await fetcher.aiUpgrade(input);
      } else if (mode === 'grammar') {
        res = await fetcher.aiGrammar(input);
      } else {
        const sepIndex = input.indexOf('|');
        let word: string;
        let context: string;
        if (sepIndex >= 0) {
          word = input.slice(0, sepIndex).trim();
          context = input.slice(sepIndex + 1).trim();
        } else {
          word = input.trim();
          context = '';
        }
        res = await fetcher.aiSynonym(word, context);
      }
      if (res.success && res.data) {
        setResult(res.data.output);
        setDetails(toDetailRows(mode, res.data.details));
        loadHistory();
      } else {
        setError(res.error ?? 'AI 调用失败');
        clientLogger.warn(`[StudentAiAssistant] 提交失败 error=${res.error ?? 'unknown'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 调用失败';
      setError(msg);
      clientLogger.warn(`[StudentAiAssistant] 提交异常 error=${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setResult(null);
    setDetails([]);
    setError(null);
  };

  const config = modeConfigs[mode];
  const displayedError = isAiNotConfigured(error) ? 'AI 服务未配置，请联系教师开通' : error;

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">AI 写作助手</h1>

          <div className="flex flex-wrap gap-2">
            {modeOrder.map((m) => (
              <Button
                key={m}
                variant={mode === m ? 'default' : 'secondary'}
                onClick={() => handleSwitchMode(m)}
              >
                {modeLabels[m]}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AiAssistantPanel
                key={mode}
                mode={mode}
                title={config.title}
                description={config.description}
                placeholder={config.placeholder}
                onSubmit={handleSubmit}
                result={result}
                details={details}
                isLoading={isLoading}
                error={displayedError}
              />
            </div>

            <Card className="self-start">
              <CardHeader>
                <CardTitle className="text-title-20 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  历史记录
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {historyLoading ? <p className="text-copy-14 text-neutral-8">加载中...</p> : null}
                {historyError ? <p className="text-copy-14 text-error">{historyError}</p> : null}
                {!historyLoading && !historyError && history.length === 0 ? (
                  <p className="text-copy-14 text-neutral-8">暂无历史记录</p>
                ) : null}
                {history.map((item) => {
                  const isOpen = expandedId === item.id;
                  return (
                    <div key={item.id} className="ring-1 ring-border rounded-md p-3">
                      <button
                        type="button"
                        className="w-full flex items-start gap-2 text-left"
                        onClick={() => setExpandedId(isOpen ? null : item.id)}
                      >
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-7" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-neutral-7" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">{item.mode}</Badge>
                            <span className="text-label-12 text-neutral-7">
                              {new Date(item.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-copy-14 text-neutral-10 truncate">
                            {truncate(item.inputText, 40)}
                          </p>
                        </div>
                      </button>
                      {isOpen ? (
                        <div className="mt-2 pl-6 space-y-1">
                          <p className="text-label-12 text-neutral-7">输出</p>
                          <p className="text-copy-14 text-neutral-10 whitespace-pre-wrap break-words">
                            {item.outputText}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
