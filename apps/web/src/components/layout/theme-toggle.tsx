'use client';

import { Button } from '@/components/ui/button';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? '切换到浅色模式' : '切换到暗色模式'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {/* Render a stable placeholder until mounted to avoid hydration mismatch. */}
      {mounted ? (
        isDark ? (
          <Sun className="text-icon-md" />
        ) : (
          <Moon className="text-icon-md" />
        )
      ) : (
        <Sun className="text-icon-md" />
      )}
    </Button>
  );
}
