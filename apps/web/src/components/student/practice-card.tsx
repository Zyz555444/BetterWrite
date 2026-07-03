'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, PenLine } from 'lucide-react';
import { useEffect } from 'react';

interface PracticeCardProps {
  question: {
    id: string;
    title: string;
    topicType: string;
    topicCategory: string | null;
    requirements: string;
    wordLimitMin: number;
    wordLimitMax: number;
    timeLimitMinutes: number | null;
    difficulty: string;
  };
  onStart?: (id: string) => void;
}

const topicTypeLabels: Record<string, string> = {
  letter: '书信',
  speech: '演讲',
  argumentation: '议论文',
  narration: '记叙文',
  proposal: '建议信',
};

const difficultyLabels: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

const difficultyClass: Record<string, string> = {
  easy: 'border-transparent bg-success/15 text-success',
  medium: 'border-transparent bg-warning/15 text-warning',
  hard: 'border-transparent bg-error/15 text-error',
};

export function PracticeCard({ question, onStart }: PracticeCardProps) {
  useEffect(() => {
    console.log(`[StudentPracticeCard] mounted id=${question.id}`);
  }, [question.id]);

  const topicLabel = topicTypeLabels[question.topicType] ?? question.topicType;
  const diffLabel = difficultyLabels[question.difficulty] ?? question.difficulty;
  const diffClass = difficultyClass[question.difficulty] ?? '';

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary">{topicLabel}</Badge>
          <Badge variant="outline" className={diffClass}>
            {diffLabel}
          </Badge>
        </div>
        <CardTitle className="text-base">{question.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-text-secondary line-clamp-3">{question.requirements}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-border">
          <div className="flex flex-col gap-1 text-xs text-text-tertiary">
            <span>
              词数：{question.wordLimitMin}-{question.wordLimitMax}
            </span>
            {question.timeLimitMinutes ? (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {question.timeLimitMinutes} 分钟
              </span>
            ) : null}
          </div>
          {onStart ? (
            <Button size="sm" onClick={() => onStart(question.id)}>
              <PenLine className="w-3.5 h-3.5" />
              开始练习
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
