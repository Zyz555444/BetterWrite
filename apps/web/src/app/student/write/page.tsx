'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { ChecklistGuard } from '@/components/student/checklist-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { ESSAY_CHECKLIST_ITEMS, useEssayDraft } from '@/lib/hooks/use-essay-draft';
import { UserRole, formatDuration } from '@betterwrite/shared';
import { AlertCircle, Clock, PenLine, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const STANDALONE_TASK_ID = 'standalone';
const WORD_LIMIT_MIN = 80;
const WORD_LIMIT_MAX = 125;

export default function FreeWritingPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const draft = useEssayDraft({
    taskId: STANDALONE_TASK_ID,
    wordLimitMin: WORD_LIMIT_MIN,
    wordLimitMax: WORD_LIMIT_MAX,
  });

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
      console.log(`[StudentWrite] submitEssay standalone wordCount=${draft.wordCount}`);
      const res = await fetcher.submitEssay({ content: draft.content, title: '自由写作' });
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
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">自由写作</Badge>
                <span className="text-sm text-text-secondary flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDuration(draft.durationMs)}
                </span>
                {draft.isSaving && <span className="text-xs text-text-tertiary">保存中...</span>}
                {justSaved && <span className="text-xs text-success">已保存</span>}
              </div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">自由写作</h1>
              <p className="text-text-secondary mt-2">请根据自己想练习的主题完成一篇英语作文。</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-text-primary">{draft.wordCount}</p>
              <p className="text-sm text-text-secondary">
                词 / {WORD_LIMIT_MIN}-{WORD_LIMIT_MAX}
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <textarea
                value={draft.content}
                onChange={(e) => draft.setContent(e.target.value)}
                placeholder="在此输入你的英语作文..."
                className="w-full min-h-[360px] resize-y rounded-md border border-border bg-bg-primary p-4 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20 transition-all"
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
              wordLimitMin={WORD_LIMIT_MIN}
              wordLimitMax={WORD_LIMIT_MAX}
            />

            <Card>
              <CardContent className="pt-6 space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  字数提示
                </div>
                <p className="text-sm text-text-secondary">
                  深圳中考英语作文建议词数为{' '}
                  <span className="font-medium text-text-primary">100-125</span> 词，
                  {WORD_LIMIT_MIN} 词为底线。
                </p>
                <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      draft.wordCount < WORD_LIMIT_MIN
                        ? 'bg-error'
                        : draft.wordCount <= WORD_LIMIT_MAX
                          ? 'bg-success'
                          : 'bg-warning'
                    }`}
                    style={{ width: `${Math.min(100, (draft.wordCount / 150) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  {draft.wordCount < WORD_LIMIT_MIN && '字数偏少，建议补充内容'}
                  {draft.wordCount >= WORD_LIMIT_MIN &&
                    draft.wordCount <= WORD_LIMIT_MAX &&
                    '字数适宜'}
                  {draft.wordCount > WORD_LIMIT_MAX && '字数偏多，注意控制'}
                </p>
              </CardContent>
            </Card>
          </div>

          {submitError && <p className="text-error text-sm">{submitError}</p>}

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
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
