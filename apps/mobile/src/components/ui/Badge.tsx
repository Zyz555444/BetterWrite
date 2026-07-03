import type { StyleProp, TextStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';
import { fontSizes, fontWeights, spacing } from '../../theme/tokens';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'accent' | 'neutral';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<TextStyle>;
  colors: ThemeColors;
};

export function Badge({ label, variant = 'neutral', style, colors }: BadgeProps) {
  const { bg, text } = getVariantColors(variant, colors);
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

function getVariantColors(variant: BadgeVariant, c: ThemeColors): { bg: string; text: string } {
  switch (variant) {
    case 'success':
      return { bg: c.success, text: '#FFFFFF' };
    case 'warning':
      return { bg: c.warning, text: '#FFFFFF' };
    case 'error':
      return { bg: c.error, text: '#FFFFFF' };
    case 'info':
      return { bg: c.info, text: '#FFFFFF' };
    case 'accent':
      return { bg: c.accent, text: '#FFFFFF' };
    case 'neutral':
      return { bg: c.bgTertiary, text: c.textSecondary };
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
