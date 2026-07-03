import { getTopicTypeLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { type EssayTask, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '进行中',
  closed: '已关闭',
};

export default function StudentTasksPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .listTasks()
      .then((res) => {
        if (res.success && res.data) {
          setTasks(res.data);
        } else {
          setError(res.error ?? '获取任务失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取任务失败'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (error) return <Empty title="加载失败" description={error} colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>作文任务</Text>
        <Button
          title="自由写作"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(student)/tasks/standalone')}
          colors={colors}
        />
      </View>

      {tasks.length === 0 ? (
        <Empty title="暂无任务" description="去写一篇文章吧" colors={colors} />
      ) : (
        tasks.map((task) => (
          <Card key={task.id} colors={colors} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Badge variant="secondary" colors={colors}>
                {getTopicTypeLabel(task.topicType)}
              </Badge>
              <Badge colors={colors}>{statusLabels[task.status] ?? task.status}</Badge>
            </View>
            <Text style={[styles.taskTitle, { color: colors.textPrimary }]}>{task.title}</Text>
            <Text
              style={[styles.taskRequirements, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {task.requirements}
            </Text>
            <View style={styles.taskMeta}>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {task.wordLimitMin}-{task.wordLimitMax} 词
              </Text>
              {task.dueDate ? (
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                  截止 {new Date(task.dueDate).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
            <Button
              title="开始写作"
              onPress={() => router.push(`/(student)/tasks/${task.id}`)}
              colors={colors}
            />
          </Card>
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
  taskCard: {
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  taskRequirements: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
  },
});
