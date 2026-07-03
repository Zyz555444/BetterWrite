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
import { AlertCircle, ArrowRight, CheckCircle2, Clock, PenLine, Sparkles } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface FeedbackError {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

export default function StudentPracticeItemPage() {
  const params = useParams();
  const router = useRouter();
  const questionId =
    typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : '';

  const [question, setQuestion] = useState<QuestionBankItem | null>(null);
  const [content, setContent] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeepSubmitting, setIsDeepSubmitting] = useState(false);
  const [feedbackErrors, setFeedbackErrors] = useState<FeedbackError[] | null>(null);

  useEffect(() => {
    console.log(`[StudentPracticeItem] mount id=${questionId}`);
  }, [questionId]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    fetcher
      .getQuestion(questionId)
      .then((res) => {
        if (res.success && res.data) {
          setQuestion(res.data);
          console.log(`[StudentPracticeItem] question loaded title=${res.data.title}`);
        } else {
          setError(res.error ?? '获取题目失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取题目失败'))
      .finally(() => setIsLoading(false));
  }, [questionId]);

  const hasSubmitted = feedbackErrors !== null;

  useEffect(() => {
    if (hasSubmitted) return;
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [hasSubmitted]);

  const wordCount = countWords(content);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmit = async () => {
    if (!question) return;
    const minWords = question.wordLimitMin;
    if (wordCount < minWords) {
      setError(`字数不足，建议至少 ${minWords} 词`);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetcher.submitPractice({
        questionId,
        content,
        durationMs: elapsed * 1000,
        exerciseType: 'question_bank',
      });
      if (res.success && res.data) {
        setFeedbackErrors(res.data.feedback.errors);
        console.log(`[StudentPracticeItem] submit ok errors=${res.data.feedback.errors.length}`);
      } else {
        setError(res.error ?? '提交失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeepSubmit = async () => {
    if (!question) return;
    setIsDeepSubmitting(true);
    setError(null);
    try {
      const res = await fetcher.submitPracticeDeep({
        questionId,
        content,
        durationMs: elapsed * 1000,
        exerciseType: 'question_bank',
      });
      if (res.success && res.data) {
        console.log(`[StudentPracticeItem] deep submit ok essayId=${res.data.essayId}`);
        router.push(`/student/essays/${res.data.essayId}`);
      } else {
        setError(res.error ?? '深度批改提交失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '深度批改提交失败');
    } finally {
      setIsDeepSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {isLoading ? (
            <p className="text-neutral-8">加载中...</p>
          ) : error && !question ? (
            <p className="text-error">{error}</p>
          ) : question ? (
            <>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{getTopicTypeLabel(question.topicType)}</Badge>
                    <span className="text-copy-14 text-neutral-8 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatTime(elapsed)}
                    </span>
                  </div>
                  <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                    {question.title}
                  </h1>
                  <p className="text-neutral-8 mt-2 whitespace-pre-wrap">{question.requirements}</p>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <p className="text-title-28 font-medium text-neutral-10">{wordCount}</p>
                  <p className="text-copy-14 text-neutral-8">
                    词 / {question.wordLimitMin}-{question.wordLimitMax}
                  </p>
                </div>
              </div>

              {question.keyPoints && question.keyPoints.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-title-20 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-accent" />
                      写作要点
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5 list-disc list-inside text-copy-14 text-neutral-8">
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
                    className="w-full min-h-[360px] resize-y rounded-md ring-1 ring-border bg-paper p-4 text-copy-16 leading-relaxed text-neutral-10 placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    spellCheck={false}
                  />
                </CardContent>
              </Card>

              {error && <p className="text-error text-copy-14">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button size="lg" onClick={handleSubmit} disabled={isSubmitting || wordCount < 10}>
                  <PenLine className="w-4 h-4 mr-2" />
                  {isSubmitting ? '提交中...' : '提交并即时反馈'}
                </Button>
              </div>

              {feedbackErrors !== null && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-title-20 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      即时反馈
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {feedbackErrors.length === 0 ? (
                      <p className="text-copy-14 text-success">很棒，未发现语法错误</p>
                    ) : (
                      <>
                        <p className="text-copy-14 text-neutral-8">
                          发现 {feedbackErrors.length} 处可改进，以下为修改建议：
                        </p>
                        <ul className="space-y-3">
                          {feedbackErrors.map((err) => (
                            <li
                              key={`${err.original}-${err.corrected}`}
                              className="rounded-md ring-1 ring-border bg-neutral-2 p-3"
                            >
                              <div className="flex items-center gap-2 flex-wrap text-copy-14">
                                <span className="text-error line-through">{err.original}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-neutral-7" />
                                <span className="text-success font-medium">{err.corrected}</span>
                                <Badge variant="outline">{err.type}</Badge>
                              </div>
                              <p className="text-label-12 text-neutral-7 mt-2">{err.explanation}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    <div className="pt-2 border-t border-border">
                      <p className="text-label-12 text-neutral-7 mb-2">
                        需要更详细的评分与建议？尝试深度批改，将由 AI 给出完整四维度评分。
                      </p>
                      <Button
                        variant="secondary"
                        onClick={handleDeepSubmit}
                        disabled={isDeepSubmitting}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {isDeepSubmitting ? '提交中...' : '深度批改'}
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
