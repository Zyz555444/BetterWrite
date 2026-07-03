'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { useEffect } from 'react';

interface ChecklistGuardProps {
  items: Array<{ key: string; label: string }>;
  checked: Record<string, boolean>;
  onToggle: (key: string) => void;
  wordCount: number;
  wordLimitMin: number;
  wordLimitMax: number;
}

export function ChecklistGuard({
  items,
  checked,
  onToggle,
  wordCount,
  wordLimitMin,
  wordLimitMax,
}: ChecklistGuardProps) {
  useEffect(() => {
    console.log(`[StudentChecklistGuard] mounted items=${items.length} wordCount=${wordCount}`);
  }, [items.length, wordCount]);

  const allChecked = items.length > 0 && items.every((item) => checked[item.key] === true);
  const wordOk = wordCount >= wordLimitMin && wordCount <= wordLimitMax;
  const ready = allChecked && wordOk;
  const wordState: 'low' | 'ok' | 'high' =
    wordCount < wordLimitMin ? 'low' : wordCount > wordLimitMax ? 'high' : 'ok';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">提交前自查</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {items.map((item) => {
            const isChecked = checked[item.key] === true;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => onToggle(item.key)}
                  className="flex items-start gap-3 w-full text-left group"
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${
                      isChecked
                        ? 'bg-accent border-accent text-white'
                        : 'border-border bg-bg-primary group-hover:border-border-hover'
                    }`}
                  >
                    {isChecked ? <Check className="w-3.5 h-3.5" /> : null}
                  </span>
                  <span
                    className={`text-sm ${isChecked ? 'text-text-primary' : 'text-text-secondary'}`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="pt-3 border-t border-border flex items-center justify-between text-sm">
          <span className="text-text-secondary">当前词数</span>
          <span className={`font-medium ${wordState === 'ok' ? 'text-success' : 'text-error'}`}>
            {wordCount} / {wordLimitMin}-{wordLimitMax}
          </span>
        </div>
        <p
          className={`text-center text-sm py-2 rounded-md ${
            ready ? 'bg-success/10 text-success' : 'bg-bg-secondary text-text-tertiary'
          }`}
        >
          {ready ? '可以提交了' : '请完成所有自查项后提交'}
        </p>
      </CardContent>
    </Card>
  );
}
