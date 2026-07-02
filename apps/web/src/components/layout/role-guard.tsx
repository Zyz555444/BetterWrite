'use client';

import { getDashboardPath, useAuth } from '@/lib/auth-store';
import type { UserRoleType } from '@betterwrite/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRoleType[];
  requireAuth?: boolean;
}

export function RoleGuard({ children, allowedRoles, requireAuth = true }: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, fetchMe } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      await fetchMe();
      setChecked(true);
    };
    check();
  }, [fetchMe]);

  useEffect(() => {
    if (!checked) return;

    if (requireAuth && !user) {
      router.replace(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }

    if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace(getDashboardPath(user.role));
    }
  }, [checked, user, requireAuth, allowedRoles, router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-text-secondary">加载中...</div>
      </div>
    );
  }

  if (requireAuth && !user) return null;
  if (user && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
