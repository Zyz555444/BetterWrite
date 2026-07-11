import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { serverFetcher } from '@/lib/api/server';
import { validateRequest } from '@/lib/auth';
import { getDashboardPath, toAuthUser } from '@/lib/auth-store';
import type { SchoolWithStats } from '@betterwrite/shared';
import { UserRole } from '@betterwrite/shared';
import { logger } from '@betterwrite/shared/logger';
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
    const res = await serverFetcher.listAdminSchools(region ? { region } : undefined);
    if (res.success && res.data) {
      schools = res.data;
    } else {
      error = res.error ?? '加载失败';
      logger.warn({ error }, '[AdminSchools] load failed');
    }
  } catch (err) {
    error = err instanceof Error ? err.message : '加载失败';
    logger.error({ err }, '[AdminSchools] load error');
  }

  return (
    <DashboardLayout user={toAuthUser(user)}>
      <SchoolsClient initialSchools={schools} initialRegion={region} initialError={error} />
    </DashboardLayout>
  );
}
