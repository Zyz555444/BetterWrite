import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    REDIS_URL: z.string().optional(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    CORS_ORIGIN: z.string().optional(),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    WORKER_HEALTH_PORT: z.coerce.number().default(8080),
    WORKER_CONCURRENCY: z.coerce.number().default(3),
    OPENAI_API_KEY: z.string().optional(),
    DEEPSEEK_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    EXPO_ACCESS_TOKEN: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV === 'production') {
        if (!data.REDIS_URL) return false;
        if (data.NEXTAUTH_SECRET.length < 32) return false;
      }
      return true;
    },
    {
      message: '生产环境必须设置 REDIS_URL，且 NEXTAUTH_SECRET 长度 >= 32',
    },
  );

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
