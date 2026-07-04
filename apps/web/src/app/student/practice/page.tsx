'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { PracticeCard } from '@/components/student';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import {
  PracticeDifficultyLabels,
  type PracticeExercise,
  type QuestionBankItem,
  TopicTypeLabels,
  UserRole,
  formatScore,
} from '@betterwrite/shared';
import { ClipboardList, Clock, History, Timer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type TabKey = 'bank' | 'mock' | 'history';

const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
  { key: 'bank', label: '题库练习', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'mock', label: '限时模拟', icon: <Timer className="w-4 h-4" /> },
  { key: 'history', label: '练习历史', icon: <History className="w-4 h-4" /> },
];

export default function StudentPracticePage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('bank');

  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [topicType, setTopicType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [isLoadingBank, setIsLoadingBank] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);

  const [history, setHistory] = useState<PracticeExercise[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {}, []);

  useEffect(() => {
    setIsLoadingBank(true);
    setBankError(null);
    const params: { topicType?: string; difficulty?: string; limit: number } = { limit: 50 };
    if (topicType) params.topicType = topicType;
    if (difficulty) params.difficulty = difficulty;
    fetcher
      .getQuestionBank(params)
      .then((res) => {
        if (res.success && res.data) {
          setQuestions(res.data);
        } else {
          setBankError(res.error ?? '获取题库失败');
        }
      })
      .catch((err) => {
        setBankError(err instanceof Error ? err.message : '获取题库失败');
      })
      .finally(() => setIsLoadingBank(false));
  }, [topicType, difficulty]);

  useEffect(() => {
    if (tab !== 'history' || hasLoadedHistory) return;
    setHasLoadedHistory(true);
    setIsLoadingHistory(true);
    setHistoryError(null);
    fetcher
      .getPracticeHistory({ limit: 20 })
      .then((res) => {
        if (res.success && res.data) {
          setHistory(res.data);
        } else {
          setHistoryError(res.error ?? '获取历史失败');
        }
      })
      .catch((err) => {
        setHistoryError(err instanceof Error ? err.message : '获取历史失败');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [tab, hasLoadedHistory]);

  const handleStart = (id: string) => {
    router.push(`/student/practice/${id}`);
  };

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-title-24 font-serif font-medium text-neutral-10">自主练习</h1>

          <div className="flex items-center gap-2 border-b border-border">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 text-copy-14 font-medium transition-colors duration-fast ease-yohaku border-b-2 -mb-px ${
                  tab === t.key
                    ? 'border-accent text-accent'
                    : 'border-transparent text-neutral-8 hover:text-neutral-10'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'bank' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="topic-filter" className="text-label-12 text-neutral-7">
                    话题类型
                  </label>
                  <select
                    id="topic-filter"
                    value={topicType}
                    onChange={(e) => setTopicType(e.target.value)}
                    className="h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                  >
                    <option value="">全部</option>
                    {Object.entries(TopicTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="diff-filter" className="text-label-12 text-neutral-7">
                    难度
                  </label>
                  <select
                    id="diff-filter"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                  >
                    <option value="">全部</option>
                    {Object.entries(PracticeDifficultyLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoadingBank && <p className="text-neutral-8">加载中...</p>}
              {bankError && <p className="text-error">{bankError}</p>}

              {!isLoadingBank && questions.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-neutral-8">题库中暂无符合条件的题目</p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {questions.map((q) => (
                  <PracticeCard key={q.id} question={q} onStart={handleStart} />
                ))}
              </div>
            </div>
          )}

          {tab === 'mock' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-title-20 flex items-center gap-2">
                  <Timer className="w-4 h-4 text-accent" />
                  限时模拟
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-copy-14 text-neutral-8 leading-relaxed">
                  系统将从题库中随机抽取一道题目，你需要在 15
                  分钟内完成写作，模拟真实考场环境。倒计时结束将自动提交。
                </p>
                <div className="flex items-center gap-2 text-copy-14 text-neutral-7">
                  <Clock className="w-4 h-4" />
                  <span>限时 15 分钟</span>
                </div>
                <Link href="/student/practice/mock">
                  <Button size="lg">
                    <Timer className="w-4 h-4 mr-2" />
                    开始模拟
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {tab === 'history' && (
            <div className="space-y-3">
              {isLoadingHistory && <p className="text-neutral-8">加载中...</p>}
              {historyError && <p className="text-error">{historyError}</p>}

              {!isLoadingHistory && history.length === 0 && (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-neutral-8">还没有练习记录</p>
                  </CardContent>
                </Card>
              )}

              {history.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.topicType ? (
                            <Badge variant="secondary">
                              {TopicTypeLabels[item.topicType as keyof typeof TopicTypeLabels] ??
                                item.topicType}
                            </Badge>
                          ) : null}
                          <Badge variant="outline">
                            {item.exerciseType === 'timed_mock' ? '限时模拟' : '题库练习'}
                          </Badge>
                          <span className="text-label-12 text-neutral-7">
                            {item.submittedAt
                              ? new Date(item.submittedAt).toLocaleString()
                              : new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="font-medium text-neutral-10 truncate">
                          {item.title ?? '未命名练习'}
                        </h3>
                        <p className="text-copy-14 text-neutral-8 mt-1 line-clamp-1">
                          {item.content}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-title-24 font-medium text-neutral-10">
                          {formatScore(item.score)}
                        </p>
                        <p className="text-label-12 text-neutral-7">{item.wordCount ?? '-'} 词</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
