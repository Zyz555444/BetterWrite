export const SCORING_WEIGHTS = {
  topicAdherence: 0.2,
  content: 0.1,
  language: 0.4,
  structure: 0.2,
  presentation: 0.1,
} as const;

export const SCORE_TIERS = [
  { tier: '1st', label: '第一档（优）', min: 13, max: 15 },
  { tier: '2nd', label: '第二档（良）', min: 10, max: 12.5 },
  { tier: '3rd', label: '第三档（中）', min: 7, max: 9.5 },
  { tier: '4th', label: '第四档（及格）', min: 4, max: 6.5 },
  { tier: '5th', label: '第五档（差）', min: 0, max: 3.5 },
] as const;

export const DEDUCTION_RULES = {
  grammarError: 0.5,
  missingKeyPoint: 1.0,
  formatError: 1.0,
  wordCountBelow: { threshold: 80, action: 'downgrade_tier' as const },
  wordCountIdeal: { min: 100, max: 125, bonus: 0.5 },
} as const;

export function getScoreTier(totalScore: number): (typeof SCORE_TIERS)[number] {
  // 按档次降序匹配，命中第一个 min 即归属该档；避免档位边界之间的浮点空隙
  // （如 12.7、9.7）落入第五档的归档错误。
  return SCORE_TIERS.find((t) => totalScore >= t.min) ?? SCORE_TIERS[4];
}
