import type { DailyQuote } from '@betterwrite/shared';
import { calculateScoreDistribution, formatScore } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from '../../components/charts';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { type Essay, type EssayTask, fetcher } from '../../lib/api/fetcher';
import { useTheme } from '../../theme/dark-mode';

interface DashboardData {
  pendingTasks: number;
  correctedEssays: number;
  averageScore: number | null;
  quote: DailyQuote | null;
}

export default function StudentHomePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [essays, setEssays] = useState<Essay[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[StudentHome] loading dashboard');
    Promise.all([fetcher.getStudentDashboard(), fetcher.listTasks(), fetcher.listMyEssays()])
      .then(([dashboardRes, tasksRes, essaysRes]) => {
        if (dashboardRes.success && dashboardRes.data) setDashboard(dashboardRes.data);
        if (tasksRes.success && tasksRes.data) setTasks(tasksRes.data);
        if (essaysRes.success && essaysRes.data) setEssays(essaysRes.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const scoreDistData = useMemo(
    () =>
      calculateScoreDistribution(
        essays
          .filter((e) => e.status === 'completed')
          .map((e) => e.totalScore)
          .filter((s): s is number => s !== null),
      ).map((item) => ({ label: item.range, value: item.count })),
    [essays],
  );

  if (isLoading) {
    return <Loading fullScreen colors={colors} />;
  }

  const stats = [
    { label: '待完成任务', value: dashboard?.pendingTasks ?? 0 },
    { label: '已批改作文', value: dashboard?.correctedEssays ?? 0 },
    { label: '平均得分', value: formatScore(dashboard?.averageScore ?? null) },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>学习首页</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            继续你的英语写作之旅
          </Text>
        </View>
        <Button
          title="去写作"
          onPress={() => router.push('/(student)/tasks')}
          colors={colors}
          size="sm"
        />
      </View>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <Card key={stat.label} colors={colors} style={styles.statCard}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
          </Card>
        ))}
      </View>

      {dashboard?.quote ? (
        <Card colors={colors} style={styles.quoteCard}>
          <Text style={[styles.quoteTitle, { color: colors.accent }]}>每日一句</Text>
          <Text style={[styles.quoteEn, { color: colors.textPrimary }]}>
            {dashboard.quote.text}
          </Text>
          <Text style={[styles.quoteCn, { color: colors.textSecondary }]}>
            {dashboard.quote.translation ?? ''}
          </Text>
        </Card>
      ) : null}

      <Card colors={colors} style={styles.chartCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>成绩分布</Text>
        <BarChart data={scoreDistData} height={180} />
      </Card>

      <Card colors={colors} style={styles.listCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>最近任务</Text>
        {tasks.slice(0, 3).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无任务</Text>
        ) : (
          tasks.slice(0, 3).map((task) => (
            <View key={task.id} style={styles.listItem}>
              <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {task.title}
              </Text>
              <Button
                title="写作"
                variant="ghost"
                size="sm"
                onPress={() => router.push(`/(student)/tasks/${task.id}`)}
                colors={colors}
              />
            </View>
          ))
        )}
      </Card>

      <Card colors={colors} style={styles.listCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>最近批改</Text>
        {essays.filter((e) => e.status === 'completed').slice(0, 3).length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无批改结果</Text>
        ) : (
          essays
            .filter((e) => e.status === 'completed')
            .slice(0, 3)
            .map((essay) => (
              <View key={essay.id} style={styles.listItem}>
                <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {essay.title ?? essay.task?.title ?? '未命名作文'}
                </Text>
                <Button
                  title={`${formatScore(essay.totalScore)} 分`}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push(`/(student)/essays/${essay.id}`)}
                  colors={colors}
                />
              </View>
            ))
        )}
      </Card>
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
  greeting: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  quoteCard: {
    marginBottom: 16,
  },
  quoteTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  quoteEn: {
    fontSize: 16,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  quoteCn: {
    fontSize: 13,
  },
  chartCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  listCard: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  listTitle: {
    flex: 1,
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
