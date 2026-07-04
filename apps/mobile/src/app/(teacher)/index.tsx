import { formatScore, getTopicTypeLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Loading } from '../../components/ui/Loading';
import { type Essay, type EssayTask, fetcher } from '../../lib/api/fetcher';
import { useTheme } from '../../theme/dark-mode';

interface DashboardData {
  stats: {
    totalClasses: number;
    totalStudents: number;
    pendingEssays: number;
    averageScore: number | null;
  };
  classes: Array<{ id: string; name: string; grade: string; studentCount: number }>;
  recentTasks: EssayTask[];
  recentEssays: Essay[];
}

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

const taskStatusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已截止',
};

export default function TeacherDashboardPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .getTeacherDashboard()
      .then((res) => {
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error ?? '加载失败');
          console.warn('[TeacherDashboard] failed:', res.error);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
        console.error('[TeacherDashboard] error:', message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loading fullScreen colors={colors} />;

  const stats = [
    { label: '任教班级', value: data?.stats.totalClasses ?? 0 },
    { label: '学生总数', value: data?.stats.totalStudents ?? 0 },
    { label: '待批改', value: data?.stats.pendingEssays ?? 0 },
    { label: '平均分', value: formatScore(data?.stats.averageScore ?? null) },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>班级概览</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            查看班级动态与批改情况
          </Text>
        </View>
        <Button
          title="布置任务"
          onPress={() => router.push('/(teacher)/tasks/create')}
          colors={colors}
          size="sm"
        />
      </View>

      {error ? (
        <Card colors={colors} style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.label} colors={colors} style={styles.statCard}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
          </Card>
        ))}
      </View>

      <Card colors={colors} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>我的班级</Text>
          <Button
            title="学生管理"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(teacher)/students')}
            colors={colors}
          />
        </View>
        {data?.classes.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无任教班级</Text>
        ) : (
          data?.classes.map((cls) => (
            <Pressable
              key={cls.id}
              style={({ pressed }) => [
                styles.listItem,
                { backgroundColor: colors.bgSecondary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push(`/(teacher)/students?classId=${cls.id}`)}
            >
              <View style={styles.listContent}>
                <Text style={[styles.listTitle, { color: colors.textPrimary }]}>
                  {cls.grade} · {cls.name}
                </Text>
                <Text style={[styles.listSub, { color: colors.textSecondary }]}>
                  {cls.studentCount} 名学生
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </Card>

      <Card colors={colors} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>最近任务</Text>
          <Button
            title="全部"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(teacher)/tasks')}
            colors={colors}
          />
        </View>
        {data?.recentTasks.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            暂无任务，点击右上角布置
          </Text>
        ) : (
          data?.recentTasks.slice(0, 5).map((task) => (
            <View key={task.id} style={[styles.listItem, { backgroundColor: colors.bgSecondary }]}>
              <View style={styles.taskRow}>
                <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {task.title}
                </Text>
                <Badge variant="secondary" colors={colors}>
                  {taskStatusLabels[task.status] ?? task.status}
                </Badge>
              </View>
              <Text style={[styles.listSub, { color: colors.textSecondary }]}>
                {getTopicTypeLabel(task.topicType)} · {task.wordLimitMin}-{task.wordLimitMax} 词
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card colors={colors} style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>最近作文</Text>
          <Button
            title="批改中心"
            variant="ghost"
            size="sm"
            onPress={() => router.push('/(teacher)/essays')}
            colors={colors}
          />
        </View>
        {data?.recentEssays.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无学生提交作文</Text>
        ) : (
          data?.recentEssays.slice(0, 5).map((essay) => (
            <Pressable
              key={essay.id}
              style={({ pressed }) => [
                styles.listItem,
                { backgroundColor: colors.bgSecondary },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push(`/(teacher)/essays/${essay.id}`)}
            >
              <View style={styles.essayRow}>
                <View style={styles.essayInfo}>
                  <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {essay.title ?? essay.task?.title ?? '未命名作文'}
                  </Text>
                  <Text style={[styles.listSub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {essay.student?.name ?? '未知学生'}
                    {essay.student?.studentNo ? ` · ${essay.student.studentNo}` : ''} ·{' '}
                    {essay.wordCount} 词
                  </Text>
                </View>
                <View style={styles.essayMeta}>
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
                    {statusLabels[essay.status] ?? essay.status}
                  </Badge>
                  {essay.status === 'completed' ? (
                    <Text style={[styles.scoreText, { color: colors.accent }]}>
                      {formatScore(essay.totalScore)} 分
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  errorCard: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
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
  sectionCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  listContent: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  listSub: {
    fontSize: 12,
    marginTop: 2,
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  essayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  essayInfo: {
    flex: 1,
  },
  essayMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  scoreText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
