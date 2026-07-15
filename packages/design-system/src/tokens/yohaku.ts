/**
 * Yohaku Design System — canonical token contract.
 *
 * Mirrors `apps/web/src/styles/globals.css` `@theme` blocks. The single source
 * of truth for color/typography/spacing decisions. When updating, keep both
 * files in sync.
 *
 * Reference: https://github.com/Innei/Yohaku (design-system/src/tokens.css)
 */

/** 梅 ume — light theme accent. CTA / focus / brand mark. ≤ 5% surface. */
export const ACCENT_LIGHT = '#c56473';
/** 桃 momo — dark theme accent (auto-applied via `.dark`). */
export const ACCENT_DARK = '#f596aa';

/**
 * Neutral 「素 Pure」 3-tier scale.
 * Tier 1 (1-4): surface / fill
 * Tier 2 (5-7): border / icon / secondary text
 * Tier 3 (8-10): body / heading
 *
 * Light mode carries warm parchment undertone (R > G > B).
 * Dark mode inverts to pure neutral gray (R = G = B) — see `darkNeutral`.
 *
 * n-5 must NEVER be used for text.
 */
export const neutral = {
  1: '#f9f8f5',
  2: '#f0efeb',
  3: '#e3e1db',
  4: '#d0cec6',
  5: '#a8a69f',
  6: '#787670',
  7: '#5c5a55',
  8: '#403f3a',
  9: '#24231f',
  10: '#141312',
} as const;

/** Dark theme neutral scale — pure gray, warmth carried solely by paper. */
export const darkNeutral = {
  1: '#141312',
  2: '#1c1c1e',
  3: '#242426',
  4: '#2c2c2e',
  5: '#5a5a5e',
  6: '#7a7a7e',
  7: '#9a9a9e',
  8: '#b8b8bc',
  9: '#d8d8dc',
  10: '#f9f8f5',
} as const;

/** Semantic colors — 和色 (Japanese traditional), restraint matched to accent. */
export const semantic = {
  /** 縹 hanada */
  info: '#3d6896',
  /** 若竹 wakatake */
  success: '#5e9f7e',
  /** 朽葉 kuchiba */
  warning: '#a87a3d',
  /** 蘇芳 suoh */
  error: '#a64953',
} as const;

export const accent = {
  light: ACCENT_LIGHT,
  dark: ACCENT_DARK,
} as const;

/** Page background (paper) — runtime-overridable via `--surface-paper`. */
export const surface = {
  paperLight: '#fefefb',
  paperDark: 'rgb(28, 28, 30)',
  borderLight: 'rgba(24, 24, 27, 0.1)',
  borderDark: 'rgba(255, 255, 255, 0.1)',
} as const;

/**
 * Typography scale — Geist-style role+px tokens.
 * Anchored on `html { font-size: 14px }` in apps/web.
 * CJK forbids synthetic bold — use `font-medium` (500) at most for headings.
 */
export const fontSize = {
  caption10: 10,
  label12: 12,
  copy13: 13,
  copy14: 14,
  copy15: 15,
  copy16: 16,
  title20: 20,
  title24: 24,
  title28: 28,
  display36: 36,
  display48: 48,
} as const;

export const lineHeight = {
  caption10: 1.4,
  label12: 1.5,
  copy13: 1.54,
  copy14: 1.57,
  copy15: 1.6,
  copy16: 1.625,
  title20: 1.4,
  title24: 1.33,
  title28: 1.29,
  display36: 1.22,
  display48: 1.17,
} as const;

/** Icon-only sizes — no line-height bundled. */
export const iconSize = {
  sm: 14,
  md: 16,
  lg: 18,
} as const;

export const font = {
  sans: "'Inter', 'SF Pro Display', system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, Helvetica, 'Noto Sans SC', 'Hiragino Sans GB', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
  serif:
    "'Noto Serif CJK SC', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif', source-han-serif-sc, 'SongTi SC', SimSum, 'Hiragino Sans GB', system-ui, 'Microsoft YaHei', 'WenQuanYi Micro Hei', serif",
  mono: "'JetBrains Mono', 'Cascadia Code PL', 'Fira Code', Consolas, Monaco, 'Hannotate SC', monospace",
} as const;

/** Animation easing. */
export const easing = {
  /** canonical Yohaku easing */
  yohaku: 'cubic-bezier(0.22, 1, 0.36, 1)',
  outExpo: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const duration = {
  fast: '200ms',
  normal: '300ms',
  slow: '500ms',
} as const;

export const YOHAKU_TOKENS = {
  accent,
  neutral,
  darkNeutral,
  semantic,
  surface,
  fontSize,
  lineHeight,
  iconSize,
  font,
  easing,
  duration,
} as const;
