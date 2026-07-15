import { formatScore, getEssayStatusLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Loading } from '../../../components/ui/Loading';
import { type Essay, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

type FilterKey = 'all' | 'pending' | 'correcting' | 'completed' | 'failed';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '等待批改' },
  { key: 'correcting', label: '批改中' },
  { key: 'completed', label: '已完成' },
  { key: 'failed', label: '失败' },
];

export default function TeacherEssaysPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [essays, setEssays] = useState<Essay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher.listTeacherEssays();
      if (res.success && res.data) {
        setEssays(res.data);
      } else {
        setError(res.error ?? '获取作文失败');
        console.warn('[TeacherEssays] failed:', res.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('[TeacherEssays] error:', message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEssays = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return essays.filter((essay) => {
      const matchStatus = statusFilter === 'all' || essay.status === statusFilter;
      const matchSearch =
        !keyword ||
        (essay.title ?? essay.task?.title ?? '').toLowerCase().includes(keyword) ||
        (essay.student?.name ?? '').toLowerCase().includes(keyword) ||
        (essay.student?.studentNo ?? '').toLowerCase().includes(keyword);
      return matchStatus && matchSearch;
    });
  }, [essays, statusFilter, search]);

  if (isLoading) return <Loading fullScreen colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>批改中心</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>查看学生提交的作文</Text>
        </View>
        <Button title="刷新" variant="secondary" size="sm" onPress={loadData} colors={colors} />
      </View>

      <Input
        label="搜索"
        value={search}
        onChangeText={setSearch}
        placeholder="学生姓名、学号或标题"
        colors={colors}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatusFilter(f.key)}
            style={[
              styles.filterChip,
              {
                backgroundColor: statusFilter === f.key ? colors.accent : colors.bgSecondary,
                borderColor: statusFilter === f.key ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: statusFilter === f.key ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <Card colors={colors} style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </Card>
      ) : null}

      <Text style={[styles.countText, { color: colors.textTertiary }]}>
        共 {filteredEssays.length} 篇
      </Text>

      {filteredEssays.length === 0 ? (
        <Card colors={colors} style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>没有匹配的作文</Text>
        </Card>
      ) : (
        filteredEssays.map((essay) => (
          <Pressable
            key={essay.id}
            onPress={() => router.push(`/(teacher)/essays/${essay.id}`)}
            style={({ pressed }) => [
              styles.essayCard,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.essayHeader}>
              <Text style={[styles.essayTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {essay.title ?? essay.task?.title ?? '未命名作文'}
              </Text>
              <Badge
                variant={
                  essay.status === 'completed'
                    ? 'success'
                    : essay.status === 'pending'
                      ? 'warning'
                      : essay.status === 'failed'
                        ? 'error'
                        : 'info'
                }
                colors={colors}
              >
                {getEssayStatusLabel(essay.status)}
              </Badge>
            </View>
            <Text style={[styles.essayMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {essay.student?.name ?? '未知学生'}
              {essay.student?.studentNo ? ` · ${essay.student.studentNo}` : ''} · {essay.wordCount}{' '}
              词
            </Text>
            <View style={styles.essayFooter}>
              <Text style={[styles.essayDate, { color: colors.textTertiary }]}>
                {new Date(essay.submittedAt).toLocaleString()}
              </Text>
              {essay.status === 'completed' ? (
                <Text style={[styles.essayScore, { color: colors.accent }]}>
                  {formatScore(essay.totalScore)} 分
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorCard: {
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    marginBottom: 8,
  },
  emptyCard: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  essayCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  essayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  essayTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  essayMeta: {
    fontSize: 13,
    marginBottom: 6,
  },
  essayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  essayDate: {
    fontSize: 12,
  },
  essayScore: {
    fontSize: 14,
    fontWeight: '600',
  },
});
