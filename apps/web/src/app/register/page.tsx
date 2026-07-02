'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetcher } from '@/lib/api/fetcher';
import { getDashboardPath } from '@/lib/auth-store';
import { UserRole } from '@betterwrite/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: UserRole.STUDENT,
    schoolCode: '',
    classCode: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await fetcher.register(form);
      if (!result.success || !result.data) {
        setError(result.error ?? '注册失败');
        return;
      }
      router.push(getDashboardPath(result.data.role as (typeof UserRole)[keyof typeof UserRole]));
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-bg-primary">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif text-text-primary">创建账号</CardTitle>
          <p className="text-text-secondary text-sm mt-1">加入 BetterWrite 提升英语写作</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-text-primary">
                姓名
              </label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="真实姓名"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-text-primary">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="your@school.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-text-primary">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少6位"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-sm font-medium text-text-primary">
                身份
              </label>
              <select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as typeof UserRole.STUDENT })
                }
                className="w-full h-10 rounded-md border border-border bg-bg-primary px-3 text-sm text-text-primary"
              >
                <option value={UserRole.STUDENT}>学生</option>
                <option value={UserRole.TEACHER}>教师</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="schoolCode" className="text-sm font-medium text-text-primary">
                  学校代码
                </label>
                <Input
                  id="schoolCode"
                  value={form.schoolCode}
                  onChange={(e) => setForm({ ...form, schoolCode: e.target.value })}
                  placeholder="选填"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="classCode" className="text-sm font-medium text-text-primary">
                  班级代码
                </label>
                <Input
                  id="classCode"
                  value={form.classCode}
                  onChange={(e) => setForm({ ...form, classCode: e.target.value })}
                  placeholder="选填"
                />
              </div>
            </div>
            {error && <p className="text-error text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </Button>
          </form>
          <p className="text-text-secondary text-sm text-center mt-4">
            已有账号？{' '}
            <Link href="/login" className="text-accent hover:underline">
              立即登录
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
