import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { ThemeColors } from '../../theme/tokens';

export type LoadingSize = 'small' | 'large' | number;

export type LoadingProps = {
  size?: LoadingSize;
  color?: string;
  fullScreen?: boolean;
  colors: ThemeColors;
};

export function Loading({ size = 'small', color, fullScreen = false, colors }: LoadingProps) {
  const indicatorColor = color ?? colors.accent;
  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size={size} color={indicatorColor} />
      </View>
    );
  }
  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={indicatorColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inline: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
