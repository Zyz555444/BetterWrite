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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-paper">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-title-24 font-serif text-neutral-10">创建账号</CardTitle>
          <p className="text-neutral-8 text-copy-14 mt-1">加入 BetterWrite 提升英语写作</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="name" className="text-copy-14 font-medium text-neutral-10">
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
              <label htmlFor="email" className="text-copy-14 font-medium text-neutral-10">
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
              <label htmlFor="password" className="text-copy-14 font-medium text-neutral-10">
                密码
              </label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少8位"
                required
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="role" className="text-copy-14 font-medium text-neutral-10">
                身份
              </label>
              <select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as typeof UserRole.STUDENT })
                }
                className="w-full h-10 rounded-md ring-1 ring-border bg-paper px-3 text-copy-14 text-neutral-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-all duration-fast ease-yohaku"
              >
                <option value={UserRole.STUDENT}>学生</option>
                <option value={UserRole.TEACHER}>教师</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="schoolCode" className="text-copy-14 font-medium text-neutral-10">
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
                <label htmlFor="classCode" className="text-copy-14 font-medium text-neutral-10">
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
            {error && <p className="text-error text-copy-14">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </Button>
          </form>
          <p className="text-neutral-8 text-copy-14 text-center mt-4">
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
