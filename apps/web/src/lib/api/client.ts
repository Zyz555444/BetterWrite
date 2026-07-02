import { hc } from 'hono/client';
import type { AppType } from './routes';

export const apiClient = hc<AppType>(
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
) as ReturnType<typeof hc<AppType>>;
