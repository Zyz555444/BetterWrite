'use client';

import { AlertCircle } from 'lucide-react';
import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[GlobalError]', error.message, error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
      <AlertCircle className="h-12 w-12 text-error" />
      <div className="text-center">
        <h2 className="text-title-20 font-medium text-neutral-10">页面加载失败</h2>
        <p className="mt-2 text-copy-14 text-neutral-8">
          {error.message || '发生未知错误，请稍后重试'}
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-accent px-4 py-2 text-copy-14 text-white hover:bg-accent/90"
      >
        重试
      </button>
    </div>
  );
}
