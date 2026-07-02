'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { UserRole, countWords } from '@betterwrite/shared';
import { AlertCircle, CheckCircle2, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const checklistItems = [
  '我是否覆盖了题目所有要点？',
  '时态和人称使用是否正确？',
  '段落结构是否清晰（开头-正文-结尾）？',
  '连接词是否使用恰当？',
  '字数是否在 80-125 词之间？',
  '书写/拼写是否有明显错误？',
];

export default function FreeWritingPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(checklistItems.length).fill(false),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wordCount = countWords(content);

  const toggleCheck = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (wordCount < 80) {
      setError('字数不足，建议至少 80 词');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetcher.submitEssay({ content, title: '自由写作' });
      if (res.success && res.data) {
        router.push(`/student/essays/${res.data.id}`);
      } else {
        setError(res.error ?? '提交失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
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
              </div>
              <h1 className="text-2xl font-serif font-bold text-text-primary">自由写作</h1>
              <p className="text-text-secondary mt-2">请根据自己想练习的主题完成一篇英语作文。</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-text-primary">{wordCount}</p>
              <p className="text-sm text-text-secondary">词 / 80-125</p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在此输入你的英语作文..."
                className="w-full min-h-[360px] resize-y rounded-md border border-border bg-bg-primary p-4 text-base leading-relaxed text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20 transition-all"
                spellCheck={false}
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  提交前自查清单
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <li key={item} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCheck(index)}
                        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          checkedItems[index]
                            ? 'bg-accent border-accent'
                            : 'border-border bg-bg-primary'
                        }`}
                      >
                        {checkedItems[index] && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                      <span
                        className={`text-sm ${checkedItems[index] ? 'text-text-tertiary line-through' : 'text-text-secondary'}`}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-accent" />
                  字数提示
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-text-secondary">
                  深圳中考英语作文建议词数为{' '}
                  <span className="font-medium text-text-primary">100-125</span> 词，80 词为底线。
                </p>
                <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      wordCount < 80 ? 'bg-error' : wordCount <= 125 ? 'bg-success' : 'bg-warning'
                    }`}
                    style={{ width: `${Math.min(100, (wordCount / 150) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  {wordCount < 80 && '字数偏少，建议补充内容'}
                  {wordCount >= 80 && wordCount <= 125 && '字数适宜'}
                  {wordCount > 125 && '字数偏多，注意控制'}
                </p>
              </CardContent>
            </Card>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex justify-end">
            <Button size="lg" onClick={handleSubmit} disabled={isSubmitting || wordCount < 10}>
              <PenLine className="w-4 h-4 mr-2" />
              {isSubmitting ? '提交中...' : '提交作文'}
            </Button>
          </div>
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
