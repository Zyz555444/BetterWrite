export const colors = {
  accent: '#33A6B8',
  accentHover: '#2A8F9F',
  accentLight: '#E8F6F8',
  accentDark: '#F596AA',
  bgPrimary: '#fefefb',
  bgSecondary: '#F8F8F5',
  bgTertiary: '#F3F3F0',
  bgElevated: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textTertiary: '#8A8A8A',
  textDisabled: '#BFBFBF',
  border: '#E8E8E3',
  borderHover: '#D4D4CF',
  success: '#16A34A',
  warning: '#CA8A04',
  error: '#DC2626',
  info: '#2563EB',
} as const;

export const darkColors = {
  accent: '#4FC2D4',
  accentHover: '#5FCFE0',
  accentLight: '#1A3A40',
  accentDark: '#F596AA',
  bgPrimary: '#161616',
  bgSecondary: '#1F1F1F',
  bgTertiary: '#262626',
  bgElevated: '#2A2A2A',
  textPrimary: '#F2F2EF',
  textSecondary: '#C4C4C0',
  textTertiary: '#8A8A8A',
  textDisabled: '#4A4A4A',
  border: '#333333',
  borderHover: '#444444',
  success: '#22C55E',
  warning: '#EAB308',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type ThemeColors = { [K in keyof typeof colors]: string };

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export type Spacing = keyof typeof spacing;

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export type Radius = keyof typeof radius;

export const fontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export type FontSize = keyof typeof fontSizes;

export const fontWeights = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeight = keyof typeof fontWeights;

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;
