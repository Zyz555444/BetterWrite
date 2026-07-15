import { type ErrorBookItem, getErrorTypeLabel } from '@betterwrite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

export default function StudentErrorBookTypePage() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const typeLabel = getErrorTypeLabel(type);

  const [errors, setErrors] = useState<ErrorBookItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masteringId, setMasteringId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetcher.getErrorBookByType(type, { offset: 0, limit: 50 });
        if (res.success && res.data) {
          setErrors(res.data);
        } else {
          console.warn('[StudentErrorBookType] load failed:', res.error);
          setError(res.error ?? '获取错题失败');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[StudentErrorBookType] load error:', message);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [type]);

  const handleMaster = async (id: string) => {
    if (masteringId) return;
    setMasteringId(id);
    try {
      const res = await fetcher.masterError(id);
      if (res.success) {
        setErrors((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  status: 'mastered' as ErrorBookItem['status'],
                  masteredAt: new Date().toISOString(),
                }
              : e,
          ),
        );
      } else {
        console.warn('[StudentErrorBookType] master failed:', res.error);
        setError(res.error ?? '标记失败');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '标记失败';
      console.error('[StudentErrorBookType] master error:', message);
      setError(message);
    } finally {
      setMasteringId(null);
    }
  };

  if (isLoading) return <Loading fullScreen colors={colors} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>错题详情 - {typeLabel}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            共 {errors.length} 条错题，消灭后可标记掌握
          </Text>
        </View>
        <Button
          title="返回"
          variant="secondary"
          size="sm"
          onPress={() => router.push('/(student)/errors')}
          colors={colors}
        />
      </View>

      {error ? <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text> : null}

      {errors.length === 0 ? (
        <Empty title="该类型暂无错题" description="去练习其他类型吧" colors={colors} />
      ) : (
        errors.map((item) => (
          <Card key={item.id} colors={colors} style={styles.errorCard}>
            <View style={styles.errorHeader}>
              <Badge
                variant={item.status === 'mastered' ? 'success' : 'destructive'}
                colors={colors}
              >
                {item.status === 'mastered' ? '已掌握' : '未消灭'}
              </Badge>
              <Text style={[styles.dateText, { color: colors.textTertiary }]}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </View>

            <View style={styles.sentenceRow}>
              <Text style={[styles.original, { color: colors.error }]}>{item.original}</Text>
              <Text style={[styles.arrow, { color: colors.textTertiary }]}>→</Text>
              <Text style={[styles.corrected, { color: colors.success }]}>{item.corrected}</Text>
            </View>

            {item.explanation ? (
              <Text style={[styles.explanation, { color: colors.textSecondary }]}>
                {item.explanation}
              </Text>
            ) : null}

            {item.status !== 'mastered' && (
              <Button
                title={masteringId === item.id ? '标记中...' : '标记掌握'}
                variant="secondary"
                size="sm"
                onPress={() => handleMaster(item.id)}
                disabled={masteringId === item.id}
                colors={colors}
              />
            )}
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
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 22,
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
  errorCard: {
    marginBottom: 12,
    gap: 12,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 12,
  },
  sentenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  original: {
    fontSize: 15,
    textDecorationLine: 'line-through',
  },
  arrow: {
    fontSize: 15,
  },
  corrected: {
    fontSize: 15,
    fontWeight: '600',
  },
  explanation: {
    fontSize: 13,
    lineHeight: 18,
  },
});
