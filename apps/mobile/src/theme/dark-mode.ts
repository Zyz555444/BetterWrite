import { useColorScheme } from 'react-native';
import type { ThemeColors } from './tokens';
import { colors, darkColors } from './tokens';

export type Theme = {
  isDark: boolean;
  colors: ThemeColors;
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    colors: isDark ? darkColors : colors,
  };
}
