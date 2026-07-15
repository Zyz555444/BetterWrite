import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { getDashboardPath, useAuth } from '../../lib/auth/store';
import { useTheme } from '../../theme/dark-mode';

export default function LoginPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { login, isLoading, error, clearError, user, isHydrated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isHydrated && user) {
      router.replace(getDashboardPath(user.role));
    }
  }, [isHydrated, user, router]);

  const handleSubmit = async () => {
    clearError();
    try {
      const loggedInUser = await login(email, password);
      router.replace(getDashboardPath(loggedInUser.role));
    } catch {
      // error is already set in store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>欢迎回来</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          登录 BetterWrite 继续学习
        </Text>

        <Card colors={colors} style={styles.card}>
          <Input
            label="邮箱"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              clearError();
            }}
            placeholder="your@school.com"
            autoCapitalize="none"
            keyboardType="email-address"
            colors={colors}
          />
          <Input
            label="密码"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError();
            }}
            placeholder="••••••••"
            secureTextEntry
            colors={colors}
          />

          {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

          <Button
            title={isLoading ? '登录中...' : '登录'}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !email || !password}
            colors={colors}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>还没有账号？</Text>
          <Text
            style={[styles.link, { color: colors.accent }]}
            onPress={() => router.push('/(auth)/register')}
          >
            立即注册
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    width: '100%',
    gap: 16,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 14,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
  },
});
