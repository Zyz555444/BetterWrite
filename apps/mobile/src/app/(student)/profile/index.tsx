import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { useAuth } from '../../../lib/auth/store';
import { useTheme } from '../../../theme/dark-mode';

const roleLabels: Record<string, string> = {
  student: '学生',
  teacher: '教师',
  school_admin: '学校管理员',
  super_admin: '超级管理员',
};

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}

const menuItems: MenuItem[] = [
  { icon: 'document-text', label: '我的作文', route: '/(student)/essays' },
  { icon: 'trophy', label: '自主练习', route: '/(student)/practice' },
  { icon: 'warning', label: '错题本', route: '/(student)/errors' },
  { icon: 'podium', label: '写作成长', route: '/(student)/progress' },
  { icon: 'sparkles', label: 'AI 助手', route: '/(student)/assistant' },
];

export default function StudentProfilePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, isHydrated, logout } = useAuth();

  useEffect(() => {}, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  if (!isHydrated) return <Loading fullScreen colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>我的</Text>

      <Card colors={colors} style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Ionicons name="person" size={32} color="#FFFFFF" />
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: colors.textPrimary }]}>
            {user?.name ?? '未登录用户'}
          </Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
            {user?.email ?? ''}
          </Text>
          {user?.role ? (
            <Text style={[styles.userRole, { color: colors.textTertiary }]}>
              {roleLabels[user.role] ?? user.role}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card colors={colors} style={styles.menuCard}>
        {menuItems.map((item, index) => (
          <Button
            key={item.route}
            title={item.label}
            variant="ghost"
            onPress={() => router.push(item.route)}
            colors={colors}
            style={[
              styles.menuButton,
              index < menuItems.length - 1 && {
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              },
            ]}
          >
            <View style={styles.menuRow}>
              <View style={styles.menuLeft}>
                <Ionicons name={item.icon} size={20} color={colors.accent} />
                <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{item.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </Button>
        ))}
      </Card>

      <Button
        title="退出登录"
        variant="outline"
        onPress={handleLogout}
        colors={colors}
        style={styles.logoutButton}
      />

      <Text style={[styles.version, { color: colors.textTertiary }]}>
        BetterWrite Student v0.1.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
  },
  userRole: {
    fontSize: 12,
    marginTop: 2,
  },
  menuCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: 16,
  },
  menuButton: {
    borderRadius: 0,
    height: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuLabel: {
    fontSize: 15,
  },
  logoutButton: {
    marginBottom: 16,
  },
  version: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 24,
  },
});
