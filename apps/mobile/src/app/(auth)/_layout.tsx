import { Stack } from 'expo-router';
import { useTheme } from '../../theme/dark-mode';

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        title: 'BetterWrite',
        headerStyle: { backgroundColor: colors.bgPrimary },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: { backgroundColor: colors.bgPrimary },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="role-select" />
    </Stack>
  );
}
