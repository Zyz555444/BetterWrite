import { type ErrorBookGroup, getErrorTypeLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

export default function StudentErrorBookPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [groups, setGroups] = useState<ErrorBookGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetcher.getErrorBookGroups();
      if (res.success && res.data) {
        setGroups(res.data);
      } else {
        console.warn('[StudentErrorBook] load failed:', res.error);
        setError(res.error ?? '获取错题本失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      console.error('[StudentErrorBook] load error:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetcher.syncErrorBook();
      if (res.success && res.data) {
        await loadGroups();
      } else {
        console.warn('[StudentErrorBook] sync failed:', res.error);
        setError(res.error ?? '同步失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '同步失败';
      console.error('[StudentErrorBook] sync error:', message);
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <Loading fullScreen colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>我的错题本</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            按错误类型查看与消灭错题，持续提升写作能力
          </Text>
        </View>
        <Button
          title={isSyncing ? '同步中...' : '同步错题'}
          variant="secondary"
          size="sm"
          onPress={handleSync}
          disabled={isSyncing}
          colors={colors}
        />
      </View>

      {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

      {groups.length === 0 ? (
        <Empty title="暂无错题" description="完成作文批改后自动汇总" colors={colors} />
      ) : (
        groups.map((group) => {
          const label = getErrorTypeLabel(group.errorType);
          const percent = group.total > 0 ? Math.round((group.mastered / group.total) * 100) : 0;
          return (
            <Card
              key={group.errorType}
              colors={colors}
              style={styles.groupCard}
              onPress={() => router.push(`/(student)/errors/${group.errorType}`)}
            >
              <View style={styles.groupHeader}>
                <Badge variant="destructive" colors={colors}>
                  {label}
                </Badge>
                <Text style={[styles.totalText, { color: colors.textTertiary }]}>
                  共 {group.total} 条
                </Text>
              </View>

              <View style={styles.progressSection}>
                <View style={styles.progressLabels}>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    已消灭 {group.mastered} / {group.total}
                  </Text>
                  <Text style={[styles.percentText, { color: colors.success }]}>{percent}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.bgTertiary }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: colors.success, width: `${percent}%` },
                    ]}
                  />
                </View>
                {group.unresolved > 0 && (
                  <Text style={[styles.unresolvedText, { color: colors.textTertiary }]}>
                    待消灭 {group.unresolved} 条
                  </Text>
                )}
              </View>

              <View style={[styles.latestBox, { backgroundColor: colors.bgSecondary }]}>
                <Text style={[styles.latestLabel, { color: colors.textTertiary }]}>最近一条</Text>
                <Text style={[styles.latestText, { color: colors.textPrimary }]} numberOfLines={2}>
                  <Text style={{ textDecorationLine: 'line-through', color: colors.error }}>
                    {group.latestOriginal}
                  </Text>{' '}
                  →{' '}
                  <Text style={{ color: colors.success, fontWeight: '600' }}>
                    {group.latestCorrected}
                  </Text>
                </Text>
              </View>
            </Card>
          );
        })
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
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 12,
  },
  groupCard: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalText: {
    fontSize: 12,
  },
  progressSection: {
    gap: 6,
    marginBottom: 12,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 13,
  },
  percentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  unresolvedText: {
    fontSize: 12,
  },
  latestBox: {
    borderRadius: 8,
    padding: 12,
    gap: 4,
  },
  latestLabel: {
    fontSize: 12,
  },
  latestText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
