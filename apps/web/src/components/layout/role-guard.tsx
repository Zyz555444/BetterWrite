'use client';

import { getDashboardPath, useAuth } from '@/lib/auth-store';
import type { UserRoleType } from '@betterwrite/shared';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  const allowedRolesRef = useRef(allowedRoles);
  allowedRolesRef.current = allowedRoles;

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

    if (
      user &&
      allowedRolesRef.current.length > 0 &&
      !allowedRolesRef.current.includes(user.role)
    ) {
      router.replace(getDashboardPath(user.role));
    }
  }, [checked, user, requireAuth, router, pathname]);

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-neutral-8 text-copy-14">加载中...</div>
      </div>
    );
  }

  if (requireAuth && !user) return null;
  if (user && allowedRolesRef.current.length > 0 && !allowedRolesRef.current.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
