import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { type AuthUser, getDashboardPath } from '@/lib/auth-store';
import type { SchoolWithStats } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { redirect } from 'next/navigation';
import { SchoolsClient } from './schools-client';

interface PageProps {
  searchParams?: { region?: string };
}

export default async function AdminSchoolsPage({ searchParams }: PageProps) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== UserRole.SUPER_ADMIN) redirect(getDashboardPath(user.role));

  const region = searchParams?.region ?? '';
  let schools: SchoolWithStats[] = [];
  let error: string | null = null;

  try {
    console.log('[AdminSchools] loading schools', region ? `region=${region}` : '(no filter)');
    const res = await serverFetcher.listAdminSchools(region ? { region } : undefined);
    if (res.success && res.data) {
      schools = res.data;
      console.log(`[AdminSchools] loaded ${schools.length} schools`);
    } else {
      error = res.error ?? '加载失败';
      console.warn('[AdminSchools] load failed:', error);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败';
    console.error('[AdminSchools] load error:', err);
  }

  return (
    <DashboardLayout user={user as AuthUser}>
      <SchoolsClient initialSchools={schools} initialRegion={region} initialError={error} />
    </DashboardLayout>
  );
}
