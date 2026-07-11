import { formatScore, getEssayStatusLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { type Essay, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

export default function StudentEssaysPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [essays, setEssays] = useState<Essay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .listMyEssays()
      .then((res) => {
        if (res.success && res.data) {
          setEssays(res.data);
        } else {
          setError(res.error ?? '获取作文失败');
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : '获取作文失败'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (error) return <Empty title="加载失败" description={error} colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>我的作文</Text>
        <Button
          title="去写作"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(student)/tasks')}
          colors={colors}
        />
      </View>

      {essays.length === 0 ? (
        <Empty title="还没有提交过作文" description="开始你的第一篇写作吧" colors={colors} />
      ) : (
        essays.map((essay) => (
          <Card
            key={essay.id}
            colors={colors}
            style={styles.essayCard}
            onPress={() => router.push(`/(student)/essays/${essay.id}`)}
          >
            <View style={styles.essayHeader}>
              <Badge
                variant={
                  essay.status === 'completed'
                    ? 'success'
                    : essay.status === 'failed'
                      ? 'error'
                      : 'secondary'
                }
                colors={colors}
              >
                {getEssayStatusLabel(essay.status)}
              </Badge>
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {new Date(essay.submittedAt).toLocaleDateString()}
              </Text>
            </View>
            <Text style={[styles.essayTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {essay.title ?? essay.task?.title ?? '未命名作文'}
            </Text>
            <Text style={[styles.essayPreview, { color: colors.textSecondary }]} numberOfLines={2}>
              {essay.content}
            </Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>
                {formatScore(essay.totalScore)}
              </Text>
              <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>/ 15</Text>
            </View>
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
  essayCard: {
    marginBottom: 12,
  },
  essayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
  },
  essayTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  essayPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
});
