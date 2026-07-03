import { z } from 'zod';

export const polishSchema = z.object({
  polished: z.string(),
  changes: z.array(
    z.object({
      original: z.string(),
      revised: z.string(),
      reason: z.string(),
    }),
  ),
});
export type PolishResult = z.infer<typeof polishSchema>;

export const upgradeSchema = z.object({
  sentences: z.array(
    z.object({
      original: z.string(),
      upgraded: z.string(),
      technique: z.string(),
    }),
  ),
});
export type UpgradeResult = z.infer<typeof upgradeSchema>;

export const synonymSchema = z.object({
  synonyms: z.array(
    z.object({
      word: z.string(),
      level: z.string(),
      example: z.string(),
    }),
  ),
});
export type SynonymResult = z.infer<typeof synonymSchema>;

export const grammarSchema = z.object({
  errors: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      type: z.string(),
      explanation: z.string(),
    }),
  ),
});
export type GrammarResult = z.infer<typeof grammarSchema>;
