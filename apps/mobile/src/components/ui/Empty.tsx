import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';
import { fontSizes, fontWeights, spacing } from '../../theme/tokens';

export type EmptyProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  colors: ThemeColors;
};

export function Empty({ icon, title, description, colors }: EmptyProps) {
  return (
    <View style={styles.container}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.textTertiary }]}>{description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing[6],
    paddingVertical: spacing[8],
  },
  icon: {
    marginBottom: spacing[4],
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  description: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    textAlign: 'center',
    lineHeight: 20,
  },
});
