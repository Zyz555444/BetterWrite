import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const API_BASE =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  'http://localhost:3000';

const TOKEN_KEY = '@betterwrite/token';

export class AuthError extends Error {
  isAuthError = true;

  constructor(message = '认证已过期,请重新登录') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn('[APIClient] getStoredToken error:', err);
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (err) {
    console.warn('[APIClient] setStoredToken error:', err);
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (err) {
    console.warn('[APIClient] clearStoredToken error:', err);
  }
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('请求超时,请检查网络后重试');
    }
    console.error(`[APIClient] network error path=${path}`, err);
    throw new Error('网络连接失败,请检查网络设置');
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    console.warn(`[APIClient] 401 path=${path} — clearing token`);
    await clearStoredToken();
    throw new AuthError();
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    console.error(`[APIClient] json parse error path=${path}`, err);
    throw new Error('响应解析失败');
  }

  if (!res.ok) {
    const message = (data as ApiResponse<unknown> | null)?.error ?? '请求失败';
    throw new Error(message);
  }

  return data as T;
}
