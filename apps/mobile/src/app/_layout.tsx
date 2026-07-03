import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../theme/dark-mode';

export default function RootLayout() {
  const { colors } = useTheme();
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
