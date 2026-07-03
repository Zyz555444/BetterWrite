'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { useEffect } from 'react';

interface ErrorCardProps {
  error: {
    id: string;
    errorType: string;
    original: string;
    corrected: string;
    explanation: string | null;
    status: string;
    createdAt: string;
  };
  onMaster?: (id: string) => void;
}

const errorTypeLabels: Record<string, string> = {
  tense: '时态',
  subject_verb: '主谓一致',
  spelling: '拼写',
  plural: '单复数',
  article: '冠词',
  preposition: '介词',
  word_form: '词性',
  pronoun: '代词',
  chinglish: '中式英语',
  sentence_structure: '句子结构',
  collocation: '搭配',
};

export function ErrorCard({ error, onMaster }: ErrorCardProps) {
  useEffect(() => {
    console.log(`[StudentErrorCard] mounted id=${error.id}`);
  }, [error.id]);

  const isMastered = error.status === 'mastered';
  const typeLabel = errorTypeLabels[error.errorType] ?? error.errorType;

  return (
    <Card className="border-l-4 border-l-error">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{typeLabel}</Badge>
        </div>
        <p className="text-text-primary leading-relaxed">
          <span className="line-through text-error">{error.original}</span>
          <ArrowRight className="inline-block w-4 h-4 mx-2 text-text-tertiary align-middle" />
          <span className="text-success font-medium">{error.corrected}</span>
        </p>
        {error.explanation ? (
          <p className="text-sm text-text-secondary">{error.explanation}</p>
        ) : null}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-xs text-text-tertiary">
            {new Date(error.createdAt).toLocaleDateString('zh-CN')}
          </span>
          {isMastered ? (
            <Badge variant="secondary" className="text-success">
              已消灭
            </Badge>
          ) : onMaster ? (
            <Button size="sm" variant="outline" onClick={() => onMaster(error.id)}>
              标记已消灭
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
