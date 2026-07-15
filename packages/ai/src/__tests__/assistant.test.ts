import { describe, expect, it } from 'vitest';
import type { ZodSchema } from 'zod';
import { checkGrammar, getSynonyms, polishEssay, upgradeSentences } from '../assistant.js';
import { BaseAIProvider } from '../providers/base.js';
import { AIProviderRouter } from '../router.js';

class MockProvider extends BaseAIProvider {
  readonly name = 'openai';
  readonly defaultModel = 'mock-model';
  lastPrompt = '';
  shouldFail = false;

  async complete(prompt: string): Promise<string> {
    this.lastPrompt = prompt;
    if (this.shouldFail) throw new Error('mock failure');
    return 'mock';
  }

  async generateObject<T>(prompt: string, _schema: ZodSchema<T>): Promise<T> {
    this.lastPrompt = prompt;
    if (this.shouldFail) throw new Error('mock failure');
    return { mock: true } as unknown as T;
  }
}

function createMockRouter(): { router: AIProviderRouter; provider: MockProvider } {
  const router = new AIProviderRouter();
  const provider = new MockProvider();
  router.register(provider);
  return { router, provider };
}

describe('polishEssay', () => {
  it('throws when no providers configured', async () => {
    const router = new AIProviderRouter();
    await expect(polishEssay(router, 'hello')).rejects.toThrow('AI 服务未配置');
  });

  it('sends prompt with the input text', async () => {
    const { router, provider } = createMockRouter();
    await polishEssay(router, 'hello world');
    expect(provider.lastPrompt).toContain('hello world');
  });

  it('includes fragment note for long text (>200 words)', async () => {
    const { router, provider } = createMockRouter();
    const longText = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    await polishEssay(router, longText);
    expect(provider.lastPrompt).toContain('[...]');
    expect(provider.lastPrompt).toContain('sampled fragment');
  });

  it('does not include fragment note for short text', async () => {
    const { router, provider } = createMockRouter();
    await polishEssay(router, 'hello world');
    expect(provider.lastPrompt).not.toContain('[...]');
  });

  it('wraps input in student_input tags', async () => {
    const { router, provider } = createMockRouter();
    await polishEssay(router, 'my essay text');
    expect(provider.lastPrompt).toContain('<student_input>');
    expect(provider.lastPrompt).toContain('my essay text');
  });
});

describe('upgradeSentences', () => {
  it('sends prompt with input text', async () => {
    const { router, provider } = createMockRouter();
    await upgradeSentences(router, 'I like reading.');
    expect(provider.lastPrompt).toContain('I like reading.');
  });

  it('truncates long text', async () => {
    const { router, provider } = createMockRouter();
    const longText = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    await upgradeSentences(router, longText);
    expect(provider.lastPrompt).toContain('[...]');
  });
});

describe('getSynonyms', () => {
  it('throws for non-alphabetic word', async () => {
    const { router } = createMockRouter();
    await expect(getSynonyms(router, '123bad', 'context')).rejects.toThrow(
      'word 参数仅允许英文字母',
    );
  });

  it('throws for word starting with non-letter', async () => {
    const { router } = createMockRouter();
    await expect(getSynonyms(router, '-test', 'context')).rejects.toThrow(
      'word 参数仅允许英文字母',
    );
  });

  it('accepts valid English word with apostrophe', async () => {
    const { router, provider } = createMockRouter();
    await getSynonyms(router, "don't", "I don't know");
    expect(provider.lastPrompt).toContain("don't");
  });

  it('includes context in prompt', async () => {
    const { router, provider } = createMockRouter();
    await getSynonyms(router, 'happy', 'I am happy today');
    expect(provider.lastPrompt).toContain('I am happy today');
  });

  it('truncates long context', async () => {
    const { router, provider } = createMockRouter();
    const longContext = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    await getSynonyms(router, 'test', longContext);
    expect(provider.lastPrompt).toContain('[...]');
  });
});

describe('checkGrammar', () => {
  it('sends prompt with input text', async () => {
    const { router, provider } = createMockRouter();
    await checkGrammar(router, 'He go to school.');
    expect(provider.lastPrompt).toContain('He go to school.');
  });

  it('truncates long text', async () => {
    const { router, provider } = createMockRouter();
    const longText = Array.from({ length: 250 }, (_, i) => `word${i}`).join(' ');
    await checkGrammar(router, longText);
    expect(provider.lastPrompt).toContain('[...]');
  });

  it('throws when no providers configured', async () => {
    const router = new AIProviderRouter();
    await expect(checkGrammar(router, 'hello')).rejects.toThrow('AI 服务未配置');
  });
});
