'use client';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-store';
import { UserRole, type UserRoleType } from '@betterwrite/shared';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  School,
  Settings,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRoleType[];
}

const navItems: NavItem[] = [
  {
    href: '/admin/dashboard',
    label: '系统概览',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    href: '/admin/schools',
    label: '学校管理',
    icon: <School className="w-4 h-4" />,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    href: '/admin/apis',
    label: 'API 管理',
    icon: <Settings className="w-4 h-4" />,
    roles: [UserRole.SUPER_ADMIN],
  },
  {
    href: '/school/dashboard',
    label: '学校概览',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    href: '/school/teachers',
    label: '教师管理',
    icon: <Users className="w-4 h-4" />,
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    href: '/school/classes',
    label: '班级管理',
    icon: <School className="w-4 h-4" />,
    roles: [UserRole.SCHOOL_ADMIN],
  },
  {
    href: '/teacher/dashboard',
    label: '班级概览',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/teacher/tasks',
    label: '作文任务',
    icon: <PenLine className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/teacher/essays',
    label: '批改中心',
    icon: <FileText className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/teacher/analytics',
    label: '数据分析',
    icon: <BarChart3 className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/teacher/students',
    label: '学生管理',
    icon: <Users className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/teacher/resources',
    label: '教学资源',
    icon: <BookOpen className="w-4 h-4" />,
    roles: [UserRole.TEACHER],
  },
  {
    href: '/student/dashboard',
    label: '学习首页',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/tasks',
    label: '作文任务',
    icon: <PenLine className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/essays',
    label: '我的作文',
    icon: <BookOpen className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/errors',
    label: '错题本',
    icon: <AlertCircle className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/assistant',
    label: 'AI 助手',
    icon: <Sparkles className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/practice',
    label: '自主练习',
    icon: <Target className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
  {
    href: '/student/progress',
    label: '成长报告',
    icon: <BarChart3 className="w-4 h-4" />,
    roles: [UserRole.STUDENT],
  },
];

const roleLabels: Record<UserRoleType, string> = {
  [UserRole.SUPER_ADMIN]: '超级管理员',
  [UserRole.SCHOOL_ADMIN]: '学校管理员',
  [UserRole.TEACHER]: '教师',
  [UserRole.STUDENT]: '学生',
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = navItems.filter((item) => user && item.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-bg-primary flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-bg-secondary">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="text-xl font-serif font-bold text-text-primary">
            BetterWrite
          </Link>
        </div>
        <nav className="flex-1 overflow-auto py-4 px-3 space-y-1">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                pathname === item.href
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <div className="mb-3">
            <p className="text-sm font-medium text-text-primary">{user?.name}</p>
            <p className="text-xs text-text-tertiary">{user ? roleLabels[user.role] : ''}</p>
          </div>
          <Button variant="secondary" size="sm" className="w-full" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            退出登录
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="flex-1 flex flex-col">
        <header className="lg:hidden h-16 border-b border-border bg-bg-secondary flex items-center justify-between px-4">
          <Link href="/" className="text-lg font-serif font-bold text-text-primary">
            BetterWrite
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </header>

        {mobileOpen && (
          <div className="lg:hidden absolute inset-x-0 top-16 z-50 bg-bg-secondary border-b border-border p-3 space-y-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                  pathname === item.href
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-secondary hover:bg-bg-tertiary'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-border mt-2">
              <Button variant="secondary" size="sm" className="w-full" onClick={handleLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </Button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
