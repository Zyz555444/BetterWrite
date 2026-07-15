import { ACCENT_LIGHT, semantic } from './yohaku.js';

interface ErrorColorToken {
  bg: string;
  text: string;
  border: string;
}

/**
 * 错误高亮配色，对齐 Yohaku 和色语义。
 * 键名与 @betterwrite/shared 的 ErrorType 常量值对齐；
 * highlight / suggestion 为非错误类标注的配色。
 *
 * 语义分组：
 * - 语法硬伤（时态/主谓一致/单复数/冠词）→ 蘇芳 suoh（error）
 * - 形式问题（拼写/词形）→ 朽葉 kuchiba（warning）
 * - 介词/代词/搭配 → 縹 hanada（info）
 * - 中式英语 → 朽葉变体（warning 偏橙）
 * - 句法结构 → 梅 ume（accent，突出）
 * - 正面标注/建议 → 若竹 wakatake / 中性
 */
const { error: SUOH, warning: KUCHIBA, info: HANADA, success: WAKATAKE } = semantic;

function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

export const ERROR_COLORS: Record<string, ErrorColorToken> = {
  tense: { bg: withAlpha(SUOH, 0.08), text: SUOH, border: withAlpha(SUOH, 0.25) },
  subject_verb: { bg: withAlpha(SUOH, 0.08), text: SUOH, border: withAlpha(SUOH, 0.25) },
  plural: { bg: withAlpha(SUOH, 0.08), text: SUOH, border: withAlpha(SUOH, 0.25) },
  article: { bg: withAlpha(SUOH, 0.08), text: SUOH, border: withAlpha(SUOH, 0.25) },
  spelling: { bg: withAlpha(KUCHIBA, 0.08), text: KUCHIBA, border: withAlpha(KUCHIBA, 0.25) },
  word_form: { bg: withAlpha(KUCHIBA, 0.08), text: KUCHIBA, border: withAlpha(KUCHIBA, 0.25) },
  preposition: { bg: withAlpha(HANADA, 0.08), text: HANADA, border: withAlpha(HANADA, 0.25) },
  pronoun: { bg: withAlpha(HANADA, 0.08), text: HANADA, border: withAlpha(HANADA, 0.25) },
  collocation: { bg: withAlpha(HANADA, 0.08), text: HANADA, border: withAlpha(HANADA, 0.25) },
  chinglish: { bg: withAlpha(KUCHIBA, 0.1), text: KUCHIBA, border: withAlpha(KUCHIBA, 0.3) },
  sentence_structure: {
    bg: withAlpha(ACCENT_LIGHT, 0.08),
    text: ACCENT_LIGHT,
    border: withAlpha(ACCENT_LIGHT, 0.25),
  },
  highlight: { bg: withAlpha(WAKATAKE, 0.08), text: WAKATAKE, border: withAlpha(WAKATAKE, 0.25) },
  suggestion: {
    bg: withAlpha('#787670', 0.08),
    text: '#5c5a55',
    border: withAlpha('#787670', 0.2),
  },
};

const FALLBACK_COLOR: ErrorColorToken = {
  bg: withAlpha('#787670', 0.08),
  text: '#5c5a55',
  border: withAlpha('#787670', 0.2),
};

export function getErrorColor(type: string): ErrorColorToken {
  return ERROR_COLORS[type] ?? FALLBACK_COLOR;
}
