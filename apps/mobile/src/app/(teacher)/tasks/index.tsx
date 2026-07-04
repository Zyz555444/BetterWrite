import { getTopicTypeLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { type EssayTask, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  closed: '已截止',
};

export default function TeacherTasksPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<EssayTask[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [classesRes, tasksRes] = await Promise.all([
        fetcher.listTeacherClasses(),
        fetcher.listTasks(),
      ]);
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
      }
      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      } else {
        setError(tasksRes.error ?? '获取任务失败');
        console.warn('[TeacherTasks] failed:', tasksRes.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('[TeacherTasks] error:', message);
    } finally {
      setIsLoading(false);
    }
  };

  const getClassLabel = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    return cls ? `${cls.grade} · ${cls.name}` : classId;
  };

  if (isLoading) return <Loading fullScreen colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>作文任务</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            布置、查看和管理班级作文任务
          </Text>
        </View>
        <Button
          title="新建"
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

      {tasks.length === 0 ? (
        <Card colors={colors} style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            暂无任务，点击右上角创建
          </Text>
        </Card>
      ) : (
        tasks.map((task) => (
          <Card key={task.id} colors={colors} style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <Text style={[styles.taskTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                {task.title}
              </Text>
              <Badge variant="secondary" colors={colors}>
                {statusLabels[task.status] ?? task.status}
              </Badge>
            </View>
            <View style={styles.badgeRow}>
              <Badge variant="outline" colors={colors}>
                {getTopicTypeLabel(task.topicType)}
              </Badge>
              <Text style={[styles.taskMeta, { color: colors.textSecondary }]}>
                {task.wordLimitMin}-{task.wordLimitMax} 词
              </Text>
            </View>
            <Text style={[styles.taskClass, { color: colors.textTertiary }]}>
              {getClassLabel(task.classId)}
            </Text>
            {task.dueDate ? (
              <Text style={[styles.taskMeta, { color: colors.textTertiary }]}>
                截止：{new Date(task.dueDate).toLocaleString()}
              </Text>
            ) : null}
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
  emptyCard: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  taskCard: {
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  taskTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 13,
  },
  taskClass: {
    fontSize: 12,
    marginTop: 2,
  },
});
