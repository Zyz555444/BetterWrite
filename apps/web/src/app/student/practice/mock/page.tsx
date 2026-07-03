'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import {
  type QuestionBankItem,
  UserRole,
  countWords,
  getTopicTypeLabel,
} from '@betterwrite/shared';
import { AlertCircle, ArrowRight, CheckCircle2, Clock, LogOut, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const MOCK_TOTAL_SECONDS = 15 * 60;

interface FeedbackError {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

export default function StudentPracticeMockPage() {
  const router = useRouter();

  const [question, setQuestion] = useState<QuestionBankItem | null>(null);
  const [content, setContent] = useState('');
  const [remaining, setRemaining] = useState(MOCK_TOTAL_SECONDS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [feedbackErrors, setFeedbackErrors] = useState<FeedbackError[] | null>(null);

  const contentRef = useRef(content);
  const remainingRef = useRef(remaining);
  const autoSubmitTriedRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  useEffect(() => {
    console.log('[StudentPracticeMock] mount');
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    fetcher
      .getQuestionBank({ limit: 50 })
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          const picked = res.data[Math.floor(Math.random() * res.data.length)];
          setQuestion(picked);
          console.log(
            `[StudentPracticeMock] picked question id=${picked.id} title=${picked.title}`,
          );
        } else {
          setLoadError(res.error ?? '题库为空，无法开始模拟');
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : '获取题目失败'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!question || hasSubmitted) return;
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [question, hasSubmitted]);

  const handleSubmit = useCallback(async () => {
    if (hasSubmitted || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const durationMs = (MOCK_TOTAL_SECONDS - remainingRef.current) * 1000;
    const body: {
      content: string;
      durationMs: number;
      exerciseType: string;
      questionId?: string;
    } = {
      content: contentRef.current,
      durationMs,
      exerciseType: 'timed_mock',
    };
    if (question) body.questionId = question.id;
    try {
      const res = await fetcher.submitPractice(body);
      if (res.success && res.data) {
        setFeedbackErrors(res.data.feedback.errors);
        setHasSubmitted(true);
        console.log(`[StudentPracticeMock] submit ok errors=${res.data.feedback.errors.length}`);
      } else {
        setError(res.error ?? '提交失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [hasSubmitted, isSubmitting, question]);

  useEffect(() => {
    if (remaining === 0 && !hasSubmitted && !isSubmitting && !autoSubmitTriedRef.current) {
      autoSubmitTriedRef.current = true;
      console.log('[StudentPracticeMock] time up, auto submit');
      handleSubmit();
    }
  }, [remaining, hasSubmitted, isSubmitting, handleSubmit]);

  const handleExit = () => {
    if (window.confirm('确定要退出本次限时模拟吗？已输入的内容将丢失。')) {
      console.log('[StudentPracticeMock] exit');
      router.push('/student/practice');
    }
  };

  const wordCount = countWords(content);
  const elapsed = MOCK_TOTAL_SECONDS - remaining;

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const remainingLow = remaining < 60 && remaining > 0;

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {isLoading ? (
            <p className="text-text-secondary">加载中...</p>
          ) : loadError ? (
            <div className="space-y-4">
              <p className="text-error">{loadError}</p>
              <Button variant="secondary" onClick={handleExit}>
                <LogOut className="w-4 h-4 mr-2" />
                返回练习首页
              </Button>
            </div>
          ) : question ? (
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">限时模拟</Badge>
                    <Badge variant="outline">{getTopicTypeLabel(question.topicType)}</Badge>
                    <span className="text-sm text-text-secondary flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      已用 {formatTime(elapsed)}
                    </span>
                  </div>
                  <h1 className="text-2xl font-serif font-bold text-text-primary">
                    {question.title}
                  </h1>
                  <p className="text-text-secondary mt-2 whitespace-pre-wrap">
                    {question.requirements}
                  </p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p
                    className={`text-3xl font-bold font-mono ${
                      remainingLow ? 'text-error animate-pulse' : 'text-text-primary'
                    }`}
                  >
                    {formatTime(remaining)}
                  </p>
                  <p className="text-sm text-text-tertiary">剩余时间</p>
                </div>
              </div>

              {question.keyPoints && question.keyPoints.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-accent" />
                      写作要点
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 list-disc list-inside text-sm text-text-secondary">
                      {question.keyPoints.map((kp) => (
                        <li key={kp}>{kp}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="在此输入你的英语作文..."
                    disabled={hasSubmitted}
                    className="w-full min-h-[360px] resize-y rounded-md border border-border bg-bg-primary p-4 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20 transition-all disabled:opacity-70"
                    spellCheck={false}
                  />
                  <div className="mt-3 flex items-center justify-between text-sm text-text-secondary">
                    <span>
                      词数：{wordCount} / {question.wordLimitMin}-{question.wordLimitMax}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {error && <p className="text-error text-sm">{error}</p>}

              {!hasSubmitted && (
                <div className="flex items-center justify-between">
                  <Button variant="ghost" onClick={handleExit}>
                    <LogOut className="w-4 h-4 mr-2" />
                    退出模拟
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={isSubmitting || wordCount < 10}
                  >
                    <PenLine className="w-4 h-4 mr-2" />
                    {isSubmitting ? '提交中...' : '提前提交'}
                  </Button>
                </div>
              )}

              {feedbackErrors !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      即时反馈
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {feedbackErrors.length === 0 ? (
                      <p className="text-sm text-success">很棒，未发现语法错误</p>
                    ) : (
                      <>
                        <p className="text-sm text-text-secondary">
                          发现 {feedbackErrors.length} 处可改进，以下为修改建议：
                        </p>
                        <ul className="space-y-3">
                          {feedbackErrors.map((err) => (
                            <li
                              key={`${err.original}-${err.corrected}`}
                              className="rounded-md border border-border bg-bg-secondary p-3"
                            >
                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                <span className="text-error line-through">{err.original}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-text-tertiary" />
                                <span className="text-success font-medium">{err.corrected}</span>
                                <Badge variant="outline">{err.type}</Badge>
                              </div>
                              <p className="text-xs text-text-tertiary mt-2">{err.explanation}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="pt-2 border-t border-border">
                      <Button variant="secondary" onClick={handleExit}>
                        <LogOut className="w-4 h-4 mr-2" />
                        返回练习首页
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
