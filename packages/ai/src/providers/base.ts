import type { ZodSchema } from 'zod';

export interface CompletionOptions {
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}

export abstract class BaseAIProvider {
  abstract readonly name: string;
  abstract readonly defaultModel: string;

  abstract complete(prompt: string, options?: CompletionOptions): Promise<string>;

  abstract generateObject<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: CompletionOptions,
  ): Promise<T>;

  async completeStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    options?: CompletionOptions,
  ): Promise<T> {
    return this.generateObject(prompt, schema, options);
  }
}
