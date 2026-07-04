'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { ChecklistGuard } from '@/components/student/checklist-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { type EssayTask, fetcher } from '@/lib/api/fetcher';
import { ESSAY_CHECKLIST_ITEMS, useEssayDraft } from '@/lib/hooks/use-essay-draft';
import { UserRole, formatDuration, getTopicTypeLabel } from '@betterwrite/shared';
import { AlertCircle, Clock, PenLine, Save } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function EssayEditorPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [task, setTask] = useState<EssayTask | null>(null);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const wordLimitMin = task?.wordLimitMin ?? 80;
  const wordLimitMax = task?.wordLimitMax ?? 125;

  const draft = useEssayDraft({ taskId, wordLimitMin, wordLimitMax });

  useEffect(() => {
    fetcher
      .getTask(taskId)
      .then((res) => {
        if (res.success && res.data) {
          setTask(res.data);
        } else {
          setTaskError(res.error ?? '获取任务失败');
        }
      })
      .catch((err) => setTaskError(err instanceof Error ? err.message : '获取任务失败'))
      .finally(() => setTaskLoading(false));
  }, [taskId]);

  const handleManualSave = async () => {
    await draft.saveDraft();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
  };

  const handleSubmit = async () => {
    if (!draft.isReady) {
      setSubmitError('请完成自查清单后再提交');
      return;
    }
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetcher.submitEssay({ content: draft.content, taskId });
      if (res.success && res.data) {
        await draft.clearDraft();
        router.push(`/student/essays/${res.data.id}`);
      } else {
        setSubmitError(res.error ?? '提交失败');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          {taskLoading ? (
            <p className="text-neutral-8">加载中...</p>
          ) : taskError && !task ? (
            <p className="text-error">{taskError}</p>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">
                      {task ? getTopicTypeLabel(task.topicType) : '自由写作'}
                    </Badge>
                    <span className="text-copy-14 text-neutral-8 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(draft.durationMs)}
                    </span>
                    {draft.isSaving && (
                      <span className="text-label-12 text-neutral-7">保存中...</span>
                    )}
                    {justSaved && <span className="text-label-12 text-success">已保存</span>}
                  </div>
                  <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                    {task?.title ?? '自由写作'}
                  </h1>
                  <p className="text-neutral-8 mt-2">
                    {task?.requirements ?? '请根据题目要求完成一篇英语作文。'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-title-28 font-medium text-neutral-10">{draft.wordCount}</p>
                  <p className="text-copy-14 text-neutral-8">
                    词 / {wordLimitMin}-{wordLimitMax}
                  </p>
                </div>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <textarea
                    value={draft.content}
                    onChange={(e) => draft.setContent(e.target.value)}
                    placeholder="在此输入你的英语作文..."
                    className="w-full min-h-[360px] resize-y rounded-md ring-1 ring-border bg-paper p-4 text-copy-16 leading-relaxed text-neutral-10 placeholder:text-neutral-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
                    spellCheck={false}
                  />
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChecklistGuard
                  items={ESSAY_CHECKLIST_ITEMS}
                  checked={draft.checklist}
                  onToggle={draft.toggleCheck}
                  wordCount={draft.wordCount}
                  wordLimitMin={wordLimitMin}
                  wordLimitMax={wordLimitMax}
                />

                <Card>
                  <CardContent className="pt-6 space-y-2">
                    <div className="flex items-center gap-2 text-neutral-10 font-medium">
                      <AlertCircle className="w-4 h-4 text-accent" />
                      字数提示
                    </div>
                    <p className="text-copy-14 text-neutral-8">
                      深圳中考英语作文建议词数为{' '}
                      <span className="font-medium text-neutral-10">100-125</span> 词，
                      {wordLimitMin} 词为底线。
                    </p>
                    <div className="h-2 bg-neutral-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-normal ease-yohaku ${
                          draft.wordCount < wordLimitMin
                            ? 'bg-error'
                            : draft.wordCount <= wordLimitMax
                              ? 'bg-success'
                              : 'bg-warning'
                        }`}
                        style={{ width: `${Math.min(100, (draft.wordCount / 150) * 100)}%` }}
                      />
                    </div>
                    <p className="text-label-12 text-neutral-7">
                      {draft.wordCount < wordLimitMin && '字数偏少，建议补充内容'}
                      {draft.wordCount >= wordLimitMin &&
                        draft.wordCount <= wordLimitMax &&
                        '字数适宜'}
                      {draft.wordCount > wordLimitMax && '字数偏多，注意控制'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {submitError && <p className="text-error text-copy-14">{submitError}</p>}

              <div className="flex justify-between items-center">
                <Button variant="secondary" onClick={handleManualSave} disabled={draft.isSaving}>
                  <Save className="w-4 h-4 mr-2" />
                  {draft.isSaving ? '保存中...' : justSaved ? '已保存' : '保存草稿'}
                </Button>
                <Button
                  size="lg"
                  onClick={handleSubmit}
                  disabled={isSubmitting || !draft.isReady}
                  title={!draft.isReady ? '请完成自查清单' : undefined}
                >
                  <PenLine className="w-4 h-4 mr-2" />
                  {isSubmitting ? '提交中...' : '提交作文'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
