import type { BaseAIProvider } from './providers/base.js';
import { DeepSeekProvider } from './providers/deepseek.js';
import { OpenAIProvider } from './providers/openai.js';

export type CorrectionType = 'content' | 'language' | 'structure' | 'scorer';

export interface RouterEnv {
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
}

export class AIProviderRouter {
  private providers = new Map<string, BaseAIProvider>();

  register(provider: BaseAIProvider): void {
    this.providers.set(provider.name, provider);
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }

  get(name: string): BaseAIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`AI provider "${name}" not registered`);
    }
    return provider;
  }

  availableNames(): string[] {
    return Array.from(this.providers.keys());
  }

  route(type: CorrectionType): BaseAIProvider {
    switch (type) {
      case 'content':
      case 'scorer':
        return this.has('openai') ? this.get('openai') : this.get('deepseek');
      default:
        return this.has('deepseek') ? this.get('deepseek') : this.get('openai');
    }
  }

  async executeWithFallback<T>(
    type: CorrectionType,
    fn: (provider: BaseAIProvider) => Promise<T>,
  ): Promise<T> {
    const primary = this.route(type);
    try {
      return await fn(primary);
    } catch (error) {
      console.warn(`Provider ${primary.name} failed, trying fallback`, error);
      const fallback = this.availableNames().find((n) => n !== primary.name);
      if (!fallback) throw error;
      return await fn(this.get(fallback));
    }
  }
}

export function createProviderRouter(
  env: RouterEnv | Record<string, string | undefined> = process.env,
): AIProviderRouter {
  const router = new AIProviderRouter();

  if (env.DEEPSEEK_API_KEY) {
    const provider = new DeepSeekProvider(env.DEEPSEEK_API_KEY, env.DEEPSEEK_BASE_URL);
    (provider as { defaultModel: string }).defaultModel = env.DEEPSEEK_MODEL ?? 'deepseek-chat';
    router.register(provider);
  }

  if (env.OPENAI_API_KEY) {
    const provider = new OpenAIProvider(env.OPENAI_API_KEY, env.OPENAI_BASE_URL);
    (provider as { defaultModel: string }).defaultModel = env.OPENAI_MODEL ?? 'gpt-4o';
    router.register(provider);
  }

  return router;
}
