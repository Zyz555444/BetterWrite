'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AiAssistantPanelProps {
  mode: 'polish' | 'upgrade' | 'synonym' | 'grammar';
  title: string;
  description: string;
  placeholder: string;
  onSubmit: (input: string) => Promise<void>;
  result: string | null;
  details?: Array<{ label: string; value: string }>;
  isLoading: boolean;
  error: string | null;
}

export function AiAssistantPanel({
  mode,
  title,
  description,
  placeholder,
  onSubmit,
  result,
  details,
  isLoading,
  error,
}: AiAssistantPanelProps) {
  const [input, setInput] = useState('');

  useEffect(() => {
    console.log(`[StudentAiAssistantPanel] mounted mode=${mode}`);
  }, [mode]);

  const computedPlaceholder =
    mode === 'synonym' ? `${placeholder}（请输入单词及上下文）` : placeholder;

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    await onSubmit(trimmed);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <span>{title}</span>
          <Badge variant="secondary">{mode}</Badge>
        </CardTitle>
        <p className="text-sm text-text-secondary">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <textarea
          className="w-full min-h-32 rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent focus-visible:ring-1 focus-visible:ring-accent/20 transition-all duration-fast ease-yohaku resize-y"
          placeholder={computedPlaceholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">{input.length} 字符</span>
          <Button onClick={handleSubmit} disabled={isLoading || !input.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                处理中...
              </>
            ) : (
              '提交'
            )}
          </Button>
        </div>
        {error ? (
          <div className="flex items-start gap-2 p-3 rounded-md bg-error/10 text-error text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}
        {result ? (
          <div className="p-4 bg-bg-secondary rounded-md">
            <p className="text-xs text-text-tertiary mb-2">结果</p>
            <p className="whitespace-pre-wrap text-text-primary text-sm leading-relaxed">
              {result}
            </p>
          </div>
        ) : null}
        {details && details.length > 0 ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {details.map((d) => (
              <div key={d.label} className="flex items-baseline gap-2">
                <dt className="text-text-tertiary">{d.label}:</dt>
                <dd className="text-text-primary">{d.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </CardContent>
    </Card>
  );
}
