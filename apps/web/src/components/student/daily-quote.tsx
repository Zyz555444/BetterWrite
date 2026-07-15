'use client';

import { Card, CardContent } from '@/components/ui/card';

interface DailyQuoteProps {
  quote: {
    id: string;
    text: string;
    translation: string | null;
    source: string | null;
  } | null;
}

export function DailyQuote({ quote }: DailyQuoteProps) {
  if (!quote) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <span className="font-serif text-accent text-4xl select-none" aria-hidden>
            &ldquo;
          </span>
          <p className="text-neutral-7 text-copy-14 mt-2">暂无金句</p>
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
          <p className="font-serif italic text-title-20 text-neutral-10 leading-relaxed">
            {quote.text}
          </p>
          {quote.translation ? (
            <p className="text-neutral-8 text-copy-14">{quote.translation}</p>
          ) : null}
          {quote.source ? <p className="text-neutral-7 text-copy-14">— {quote.source}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
