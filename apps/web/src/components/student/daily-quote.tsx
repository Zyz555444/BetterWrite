'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useEffect } from 'react';

interface DailyQuoteProps {
  quote: {
    id: string;
    text: string;
    translation: string | null;
    source: string | null;
  } | null;
}

export function DailyQuote({ quote }: DailyQuoteProps) {
  useEffect(() => {
    console.log(`[StudentDailyQuote] mounted hasQuote=${quote ? 'true' : 'false'}`);
  }, [quote]);

  if (!quote) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <span className="font-serif text-accent text-4xl select-none" aria-hidden>
            &ldquo;
          </span>
          <p className="text-text-tertiary text-sm mt-2">暂无金句</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 flex gap-4">
        <span
          className="font-serif text-accent text-4xl leading-none select-none flex-shrink-0"
          aria-hidden
        >
          &ldquo;
        </span>
        <div className="flex-1 space-y-2">
          <p className="font-serif italic text-lg text-text-primary leading-relaxed">
            {quote.text}
          </p>
          {quote.translation ? (
            <p className="text-text-secondary text-sm">{quote.translation}</p>
          ) : null}
          {quote.source ? <p className="text-text-tertiary text-sm">— {quote.source}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
