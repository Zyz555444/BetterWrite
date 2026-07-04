'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getErrorTypeLabel } from '@betterwrite/shared';
import { ArrowRight } from 'lucide-react';

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

export function ErrorCard({ error, onMaster }: ErrorCardProps) {
  const isMastered = error.status === 'mastered';
  const typeLabel = getErrorTypeLabel(error.errorType);

  return (
    <Card className="border-l-4 border-l-error">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{typeLabel}</Badge>
        </div>
        <p className="text-neutral-10 leading-relaxed">
          <span className="line-through text-error">{error.original}</span>
          <ArrowRight className="inline-block w-4 h-4 mx-2 text-neutral-7 align-middle" />
          <span className="text-success font-medium">{error.corrected}</span>
        </p>
        {error.explanation ? (
          <p className="text-copy-14 text-neutral-8">{error.explanation}</p>
        ) : null}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-label-12 text-neutral-7">
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
