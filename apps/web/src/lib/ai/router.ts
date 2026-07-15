import { type AIProviderRouter, createProviderRouter } from '@betterwrite/ai';

let routerInstance: AIProviderRouter | null = null;

export function getAiRouter(): AIProviderRouter {
  if (!routerInstance) {
    routerInstance = createProviderRouter(process.env);
  }
  return routerInstance;
}
