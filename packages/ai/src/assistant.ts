import {
  type GrammarResult,
  type PolishResult,
  type SynonymResult,
  type UpgradeResult,
  grammarSchema,
  polishSchema,
  synonymSchema,
  upgradeSchema,
} from './assistants/schemas.js';
import type { AIProviderRouter } from './router.js';

function truncate(text: string, maxWords = 200): string {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= maxWords) return text;
  const head = words.slice(0, 100).join(' ');
  const tail = words.slice(-50).join(' ');
  return `${head} [...] ${tail}`;
}

export async function polishEssay(router: AIProviderRouter, text: string): Promise<PolishResult> {
  if (router.availableNames().length === 0) {
    throw new Error('AI 服务未配置，请联系管理员');
  }
  const sampled = truncate(text);
  const isFragment = sampled !== text;
  const prompt = `You are an English writing tutor for Chinese middle school students. Polish the following English text to improve clarity, vocabulary, and grammar WITHOUT changing the original meaning.${isFragment ? ' Note: the input below is a sampled fragment (first 100 and last 50 words) of a longer essay.' : ''} Return JSON {polished, changes:[{original,revised,reason}]}. Text: ${sampled}`;
  return router.executeWithFallback('language', (provider) =>
    provider.completeStructured(prompt, polishSchema, { maxOutputTokens: 1024 }),
  );
}

export async function upgradeSentences(
  router: AIProviderRouter,
  text: string,
): Promise<UpgradeResult> {
  if (router.availableNames().length === 0) {
    throw new Error('AI 服务未配置，请联系管理员');
  }
  const sampled = truncate(text);
  const isFragment = sampled !== text;
  const prompt = `Identify simple sentences in the following text and upgrade them to more advanced structures (inversion, relative clauses, etc) suitable for Chinese middle school students.${isFragment ? ' Note: the input below is a sampled fragment (first 100 and last 50 words) of a longer essay.' : ''} Return JSON {sentences:[{original,upgraded,technique}]}. Text: ${sampled}`;
  return router.executeWithFallback('language', (provider) =>
    provider.completeStructured(prompt, upgradeSchema, { maxOutputTokens: 1024 }),
  );
}

export async function getSynonyms(
  router: AIProviderRouter,
  word: string,
  context: string,
): Promise<SynonymResult> {
  if (router.availableNames().length === 0) {
    throw new Error('AI 服务未配置，请联系管理员');
  }
  const sampledContext = truncate(context);
  const isFragment = sampledContext !== context;
  const prompt = `Suggest 5 advanced synonyms for the word '${word}' in this context, suitable for Chinese middle school students.${isFragment ? ' Note: the context below is a sampled fragment of a longer text.' : ''} Return JSON {synonyms:[{word,level,example}]} where level is one of basic/intermediate/advanced. Context: ${sampledContext}`;
  return router.executeWithFallback('language', (provider) =>
    provider.completeStructured(prompt, synonymSchema, { maxOutputTokens: 1024 }),
  );
}

export async function checkGrammar(router: AIProviderRouter, text: string): Promise<GrammarResult> {
  if (router.availableNames().length === 0) {
    throw new Error('AI 服务未配置，请联系管理员');
  }
  const sampled = truncate(text);
  const isFragment = sampled !== text;
  const prompt = `Check grammar of the following English text written by Chinese middle school students.${isFragment ? ' Note: the input below is a sampled fragment (first 100 and last 50 words) of a longer essay.' : ''} Return JSON {errors:[{original,corrected,type,explanation}]}. If no errors, return empty array. Text: ${sampled}`;
  return router.executeWithFallback('language', (provider) =>
    provider.completeStructured(prompt, grammarSchema, { maxOutputTokens: 1024 }),
  );
}
