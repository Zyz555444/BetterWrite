import type { UserRoleType } from '@betterwrite/shared';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { AuthError, clearStoredToken, setStoredToken } from '../api/client';
import { fetcher } from '../api/fetcher';

const TOKEN_KEY = '@betterwrite/token';
const USER_KEY = '@betterwrite/user';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRoleType;
  schoolId: string | null;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

function normalizeUser(data: {
  userId?: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}): AuthUser {
  return {
    id: data.userId ?? data.id ?? '',
    name: data.name,
    email: data.email,
    role: data.role as UserRoleType,
    schoolId: data.schoolId,
  };
}

async function persistUser(user: AuthUser): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

async function clearPersistedUser(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (err) {
    console.warn('[AuthStore] clearPersistedUser error:', err);
  }
}

async function readPersistedUser(): Promise<AuthUser | null> {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch (err) {
    console.warn('[AuthStore] readPersistedUser error:', err);
    return null;
  }
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isHydrated: false,
  error: null,
  setUser: (user) => set({ user }),

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const deviceName = Device.deviceName ?? 'unknown';
      const result = await fetcher.loginWithToken({ email, password, platform, deviceName });
      if (!result.success || !result.data) {
        const message = result.error ?? '登录失败';
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
      const { token, user: rawUser } = result.data;
      const user = normalizeUser(rawUser);
      await setStoredToken(token);
      await persistUser(user);
      set({ user, token, isLoading: false });
      console.log(`[AuthStore] login success userId=${user.id} role=${user.role}`);
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  logout: async () => {
    await clearStoredToken();
    await clearPersistedUser();
    set({ user: null, token: null, error: null });
    console.log('[AuthStore] logout cleared');
  },

  fetchMe: async () => {
    try {
      const result = await fetcher.me();
      if (result.success && result.data) {
        const user = normalizeUser({
          id: result.data.id,
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
          schoolId: result.data.schoolId,
        });
        await persistUser(user);
        set({ user });
      } else {
        await get().logout();
      }
    } catch (err) {
      if (err instanceof AuthError) {
        console.warn('[AuthStore] fetchMe auth error, logging out');
        await get().logout();
      } else {
        console.warn('[AuthStore] fetchMe error:', err);
      }
    }
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const user = await readPersistedUser();
      if (token && user) {
        set({ token, user });
        console.log(`[AuthStore] restoreSession optimistic userId=${user.id}`);
        await get().fetchMe();
      } else {
        set({ user: null, token: null });
      }
    } catch (err) {
      console.warn('[AuthStore] restoreSession error:', err);
      set({ user: null, token: null });
    } finally {
      set({ isHydrated: true });
    }
  },

  clearError: () => set({ error: null }),
}));

export type { AuthUser, AuthState };
