import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText } from 'ai';
import type { ZodSchema } from 'zod';
import { BaseAIProvider, type CompletionOptions } from './base.js';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'gpt-4o';

  private client;

  constructor(apiKey: string, baseURL?: string) {
    super();
    this.client = createOpenAI({ apiKey, baseURL });
  }

  async complete(prompt: string, options?: CompletionOptions): Promise<string> {
    const { text } = await generateText({
      model: this.client(options?.model ?? this.defaultModel),
      prompt,
      temperature: options?.temperature ?? 0.3,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
      abortSignal: AbortSignal.timeout(60_000),
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
      abortSignal: AbortSignal.timeout(60_000),
    });
    return object;
  }
}
