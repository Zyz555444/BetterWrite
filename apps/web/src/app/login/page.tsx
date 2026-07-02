'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getDashboardPath, useAuth } from '@/lib/auth-store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      const user = await login(email, password);
      router.push(getDashboardPath(user.role));
    } catch {
      // error is already set in store
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-text-primary">欢迎回来</CardTitle>
          <p className="text-text-secondary text-sm mt-1">登录 BetterWrite 继续学习</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="email">
                邮箱
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@school.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="password">
                密码
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-error text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
          <p className="text-text-secondary text-sm text-center mt-4">
            还没有账号？{' '}
            <Link href="/register" className="text-accent hover:underline">
              立即注册
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
