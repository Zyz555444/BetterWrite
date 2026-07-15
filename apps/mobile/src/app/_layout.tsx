import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth/store';
import { useTheme } from '../theme/dark-mode';

export default function RootLayout() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, isHydrated, restoreSession } = useAuth();

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (isHydrated) {
      if (user) {
        router.replace(user.role === 'teacher' ? '/(teacher)' : '/(student)');
      }
    }
  }, [isHydrated, user, router]);

  return (
    <SafeAreaProvider>
      <Stack
        initialRouteName="(auth)/login"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="(teacher)" />
      </Stack>
    </SafeAreaProvider>
  );
}
