'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';

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
  const allChecked = items.length > 0 && items.every((item) => checked[item.key] === true);
  const wordOk = wordCount >= wordLimitMin && wordCount <= wordLimitMax;
  const ready = allChecked && wordOk;
  const wordState: 'low' | 'ok' | 'high' =
    wordCount < wordLimitMin ? 'low' : wordCount > wordLimitMax ? 'high' : 'ok';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-title-20">提交前自查</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {items.map((item) => {
            const isChecked = checked[item.key] === true;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  aria-pressed={isChecked}
                  onClick={() => onToggle(item.key)}
                  className="flex items-start gap-3 w-full text-left group"
                >
                  <span
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center transition-colors duration-fast ease-yohaku flex-shrink-0 ${
                      isChecked
                        ? 'bg-accent ring-1 ring-accent text-white'
                        : 'bg-paper ring-1 ring-border group-hover:ring-neutral-4'
                    }`}
                  >
                    {isChecked ? <Check className="w-3.5 h-3.5" /> : null}
                  </span>
                  <span
                    className={`text-copy-14 ${isChecked ? 'text-neutral-10' : 'text-neutral-8'}`}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="pt-3 border-t border-border flex items-center justify-between text-copy-14">
          <span className="text-neutral-8">当前词数</span>
          <span className={`font-medium ${wordState === 'ok' ? 'text-success' : 'text-error'}`}>
            {wordCount} / {wordLimitMin}-{wordLimitMax}
          </span>
        </div>
        <p
          className={`text-center text-copy-14 py-2 rounded-md ${
            ready ? 'bg-success/10 text-success' : 'bg-neutral-2 text-neutral-7'
          }`}
        >
          {ready ? '可以提交了' : '请完成所有自查项后提交'}
        </p>
      </CardContent>
    </Card>
  );
}
