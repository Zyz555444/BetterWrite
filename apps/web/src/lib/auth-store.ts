import type { UserRoleType } from '@betterwrite/shared';
import { create } from 'zustand';
import { fetcher } from './api/fetcher';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleType;
  schoolId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

function normalizeUser(data: {
  userId: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}): AuthUser {
  return {
    id: data.userId,
    name: data.name,
    email: data.email,
    role: data.role as UserRoleType,
    schoolId: data.schoolId,
  };
}

export function toAuthUser(data: {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}): AuthUser {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRoleType,
    schoolId: data.schoolId,
  };
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,
  setUser: (user) => set({ user }),
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const result = await fetcher.login(email, password);
      if (!result.success || !result.data) {
        set({ isLoading: false, error: result.error ?? '登录失败' });
        throw new Error(result.error ?? '登录失败');
      }
      const user = normalizeUser(result.data);
      set({ user, isLoading: false });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      set({ isLoading: false, error: message });
      throw err;
    }
  },
  logout: async () => {
    await fetcher.logout();
    set({ user: null });
  },
  fetchMe: async () => {
    try {
      const result = await fetcher.me();
      if (result.success && result.data) {
        set({ user: normalizeUser({ userId: result.data.id, ...result.data }) });
      } else {
        set({ user: null });
      }
    } catch {
      set({ user: null });
    }
  },
  clearError: () => set({ error: null }),
}));

export function getDashboardPath(role: UserRoleType): string {
  switch (role) {
    case 'super_admin':
      return '/admin/dashboard';
    case 'school_admin':
      return '/school/dashboard';
    case 'teacher':
      return '/teacher/dashboard';
    case 'student':
      return '/student/dashboard';
    default:
      return '/';
  }
}
