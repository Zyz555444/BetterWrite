'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { RoleGuard } from '@/components/layout/role-guard';
import { ErrorCard } from '@/components/student';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetcher } from '@/lib/api/fetcher';
import { type ErrorBookItem, UserRole, getErrorTypeLabel } from '@betterwrite/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function StudentErrorBookTypePage() {
  const params = useParams();
  const type = typeof params.type === 'string' ? params.type : String(params.type ?? '');
  const typeLabel = getErrorTypeLabel(type);

  const [errors, setErrors] = useState<ErrorBookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masteringId, setMasteringId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetcher.getErrorBookByType(type, { offset: 0, limit: 50 });
        if (res.success && res.data) {
          setErrors(res.data);
        } else {
          console.warn('[StudentErrorBookType] load failed:', res.error);
          setError(res.error ?? '获取错题失败');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[StudentErrorBookType] load error:', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [type]);

  const handleMaster = async (id: string) => {
    if (masteringId) return;
    setMasteringId(id);
    try {
      const res = await fetcher.masterError(id);
      if (res.success) {
        setErrors((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'mastered' as ErrorBookItem['status'],
                  masteredAt: new Date().toISOString(),
                }
              : e,
          ),
        );
      } else {
        console.warn('[StudentErrorBookType] master failed:', res.error);
        setError(res.error ?? '标记失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '标记失败';
      console.error('[StudentErrorBookType] master error:', message);
      setError(message);
    } finally {
      setMasteringId(null);
    }
  };

  return (
    <RoleGuard allowedRoles={[UserRole.STUDENT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-title-24 font-serif font-medium text-neutral-10">
                错题详情 - {typeLabel}
              </h1>
              <p className="text-copy-14 text-neutral-8 mt-1">
                共 {errors.length} 条错题，消灭后可标记掌握
              </p>
            </div>
            <Link href="/student/errors">
              <Button variant="secondary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回错题本
              </Button>
            </Link>
          </div>

          {error && <p className="text-error text-copy-14">{error}</p>}

          {isLoading ? (
            <p className="text-neutral-8 text-copy-14">加载中...</p>
          ) : errors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-neutral-8">该类型暂无错题</p>
                <Link href="/student/errors" className="inline-block mt-4">
                  <Button variant="outline">返回错题本</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {errors.map((item) => (
                <ErrorCard
                  key={item.id}
                  error={{
                    id: item.id,
                    errorType: item.errorType,
                    original: item.original,
                    corrected: item.corrected,
                    explanation: item.explanation,
                    status: item.status,
                    createdAt: item.createdAt,
                  }}
                  onMaster={handleMaster}
                />
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </RoleGuard>
  );
}
