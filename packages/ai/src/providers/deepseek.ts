import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateObject, generateText } from 'ai';
import type { ZodSchema } from 'zod';
import { DEFAULT_AI_TIMEOUT_MS, type CompletionOptions } from './base.js';

export class DeepSeekProvider extends BaseAIProvider {
  readonly name = 'deepseek';
  readonly defaultModel = 'deepseek-chat';

  private client;

  constructor(apiKey: string, baseURL?: string) {
    super();
    this.client = createDeepSeek({ apiKey, baseURL });
  }

  // Bug #142: 与 OpenAI 对齐，默认 30s 超时（之前硬编码 60s）。
  private buildAbortSignal(options?: CompletionOptions): AbortSignal {
    return AbortSignal.timeout(options?.timeoutMs ?? DEFAULT_AI_TIMEOUT_MS);
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const { text } = await generateText({
      model: this.client(options?.model ?? this.defaultModel),
      prompt,
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      abortSignal: this.buildAbortSignal(options),
    });
    return text;
  }

  async generateObject<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: CompletionOptions,
  ): Promise<T> {
    const { object } = await generateObject({
      model: this.client(options?.model ?? this.defaultModel),
      prompt,
      schema,
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      abortSignal: this.buildAbortSignal(options),
    });
    return object;
  }
}
