import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';
import { fontSizes, fontWeights, spacing } from '../../theme/tokens';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'accent'
  | 'neutral';

export type BadgeProps = {
  children: ReactNode;
  variant?: BadgeVariant;
  style?: StyleProp<TextStyle>;
  colors: ThemeColors;
};

export function Badge({ children, variant = 'neutral', style, colors }: BadgeProps) {
  const { bg, text, border } = getVariantColors(variant, colors);
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg, borderColor: border, borderWidth: border ? 1 : 0 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: text }]}>{children}</Text>
    </View>
  );
}

function getVariantColors(
  variant: BadgeVariant,
  c: ThemeColors,
): { bg: string; text: string; border: string | undefined } {
  switch (variant) {
    case 'default':
    case 'accent':
      return { bg: c.accent, text: '#FFFFFF', border: undefined };
    case 'secondary':
      return { bg: c.bgSecondary, text: c.textSecondary, border: undefined };
    case 'outline':
      return { bg: 'transparent', text: c.textSecondary, border: c.border };
    case 'destructive':
    case 'error':
      return { bg: c.error, text: '#FFFFFF', border: undefined };
    case 'warning':
      return { bg: c.warning, text: '#FFFFFF', border: undefined };
    case 'info':
      return { bg: c.info, text: '#FFFFFF', border: undefined };
    case 'success':
      return { bg: c.success, text: '#FFFFFF', border: undefined };
    case 'neutral':
      return { bg: c.bgTertiary, text: c.textSecondary, border: undefined };
  }
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
  },
});
