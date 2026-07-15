import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { colors, darkColors, fontSizes, fontWeights, spacing } from './tokens';

export type ThemedStyles = {
  container: ViewStyle;
  card: ViewStyle;
  row: ViewStyle;
  center: ViewStyle;
  centerVertical: ViewStyle;
  spaceBetween: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  body: TextStyle;
  label: TextStyle;
  caption: TextStyle;
  divider: ViewStyle;
  input: TextStyle;
  inputLabel: TextStyle;
  inputError: TextStyle;
};

export function createThemedStyles(isDark: boolean): ThemedStyles {
  const c = isDark ? darkColors : colors;
  return StyleSheet.create<ThemedStyles>({
    container: {
      flex: 1,
      backgroundColor: c.bgPrimary,
      paddingHorizontal: spacing[4],
    },
    card: {
      backgroundColor: c.bgElevated,
      borderRadius: 12,
      padding: spacing[4],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centerVertical: {
      justifyContent: 'center',
    },
    spaceBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      fontSize: fontSizes['2xl'],
      fontWeight: fontWeights.bold,
      color: c.textPrimary,
      lineHeight: 30,
    },
    subtitle: {
      fontSize: fontSizes.lg,
      fontWeight: fontWeights.semibold,
      color: c.textSecondary,
      lineHeight: 26,
    },
    body: {
      fontSize: fontSizes.base,
      fontWeight: fontWeights.normal,
      color: c.textPrimary,
      lineHeight: 24,
    },
    label: {
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.medium,
      color: c.textSecondary,
      lineHeight: 20,
    },
    caption: {
      fontSize: fontSizes.xs,
      fontWeight: fontWeights.normal,
      color: c.textTertiary,
      lineHeight: 18,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: spacing[2],
    },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: spacing[3],
      paddingVertical: spacing[3],
      fontSize: fontSizes.base,
      color: c.textPrimary,
      backgroundColor: c.bgElevated,
    },
    inputLabel: {
      fontSize: fontSizes.sm,
      fontWeight: fontWeights.medium,
      color: c.textSecondary,
      marginBottom: spacing[2],
    },
    inputError: {
      fontSize: fontSizes.xs,
      color: c.error,
      marginTop: spacing[1],
    },
  });
}
