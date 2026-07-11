import { formatScore, getEssayStatusLabel } from '@betterwrite/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { type CorrectionDetail, type Essay, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

export default function TeacherEssayDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [essay, setEssay] = useState<Essay | null>(null);
  const [correction, setCorrection] = useState<CorrectionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey intentionally triggers reload
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [essayRes, correctionRes] = await Promise.all([
          fetcher.getEssay(id),
          fetcher.getCorrection(id),
        ]);
        if (essayRes.success && essayRes.data) {
          setEssay(essayRes.data);
        } else {
          setError(essayRes.error ?? '获取作文失败');
          console.warn('[TeacherEssayDetail] getEssay failed:', essayRes.error);
        }
        if (correctionRes.success && correctionRes.data) {
          setCorrection(correctionRes.data);
        } else {
          setCorrection(null);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
        console.error('[TeacherEssayDetail] error:', message);
      } finally {
        setIsLoading(false);
      }
    };
    void loadData();
  }, [id, refreshKey]);

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (error || !essay) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error ?? '作文不存在'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
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
        {essay.status === 'pending' || essay.status === 'correcting' ? (
          <Button
            title="刷新"
            variant="ghost"
            size="sm"
            onPress={() => setRefreshKey((k) => k + 1)}
            colors={colors}
          />
        ) : null}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {essay.title ?? essay.task?.title ?? '作文详情'}
      </Text>
      <Text style={[styles.meta, { color: colors.textSecondary }]}>
        学生：{essay.student?.name ?? '未知学生'}
        {essay.student?.studentNo ? ` · ${essay.student.studentNo}` : ''} · {essay.wordCount} 词
      </Text>
      <Text style={[styles.meta, { color: colors.textTertiary }]}>
        提交于 {new Date(essay.submittedAt).toLocaleString()}
      </Text>

      <Card colors={colors} style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>原文</Text>
        <Text style={[styles.contentText, { color: colors.textPrimary }]}>{essay.content}</Text>
      </Card>

      {essay.status === 'pending' ? (
        <Card colors={colors} style={styles.statusCard}>
          <Text style={[styles.statusTitle, { color: colors.accent }]}>作文正在排队等待批改</Text>
          <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
            请稍候刷新查看结果
          </Text>
        </Card>
      ) : null}

      {essay.status === 'correcting' ? (
        <Card colors={colors} style={styles.statusCard}>
          <Text style={[styles.statusTitle, { color: colors.accent }]}>AI 正在批改中</Text>
          <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
            通常需要几秒到几十秒
          </Text>
        </Card>
      ) : null}

      {essay.status === 'failed' ? (
        <Card colors={colors} style={styles.statusCard}>
          <Text style={[styles.statusTitle, { color: colors.error }]}>批改失败</Text>
          <Text style={[styles.statusDesc, { color: colors.textSecondary }]}>
            可尝试刷新或检查 worker 日志
          </Text>
        </Card>
      ) : null}

      {correction ? (
        <>
          <Card colors={colors} style={styles.sectionCard}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>总分</Text>
            <View style={styles.scoreRow}>
              <Text style={[styles.totalScore, { color: colors.accent }]}>
                {formatScore(correction.totalScore)}
              </Text>
              <Text style={[styles.scoreTier, { color: colors.textSecondary }]}>
                {correction.scoreTier ?? ''}
              </Text>
            </View>
            <View style={styles.dimensionRow}>
              <DimensionItem
                label="审题扣题"
                value={correction.topicAdherenceScore}
                colors={colors}
              />
              <DimensionItem label="内容" value={correction.contentScore} colors={colors} />
              <DimensionItem label="语言" value={correction.languageScore} colors={colors} />
              <DimensionItem label="结构" value={correction.structureScore} colors={colors} />
              <DimensionItem label="书写" value={correction.presentationScore} colors={colors} />
            </View>
          </Card>

          {correction.errors.length > 0 ? (
            <Card colors={colors} style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>错误分析</Text>
              {correction.errors.map((err, idx) => (
                <View key={`${err.original}-${err.corrected}-${idx}`} style={styles.errorItem}>
                  <View style={styles.errorHeader}>
                    <Text style={[styles.errorOriginal, { color: colors.error }]}>
                      {err.original}
                    </Text>
                    <Text style={[styles.errorArrow, { color: colors.textTertiary }]}>→</Text>
                    <Text style={[styles.errorCorrected, { color: colors.success }]}>
                      {err.corrected}
                    </Text>
                    <Badge variant="outline" colors={colors}>
                      {err.type}
                    </Badge>
                  </View>
                  <Text style={[styles.errorExplanation, { color: colors.textSecondary }]}>
                    {err.explanation}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {correction.suggestions.length > 0 ? (
            <Card colors={colors} style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>提升建议</Text>
              {correction.suggestions.map((s, idx) => (
                <View key={`${s.category}-${idx}`} style={styles.suggestionItem}>
                  <Badge
                    variant={
                      s.priority === 'high'
                        ? 'error'
                        : s.priority === 'medium'
                          ? 'warning'
                          : 'secondary'
                    }
                    colors={colors}
                  >
                    {s.priority}
                  </Badge>
                  <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>
                    {s.suggestion}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}

          {correction.revisedEssay ? (
            <Card colors={colors} style={styles.sectionCard}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>改写范文</Text>
              <Text style={[styles.contentText, { color: colors.textPrimary }]}>
                {correction.revisedEssay}
              </Text>
            </Card>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function DimensionItem({
  label,
  value,
  colors,
}: {
  label: string;
  value: number | null;
  colors: { textPrimary: string; textSecondary: string };
}) {
  return (
    <View style={styles.dimensionItem}>
      <Text style={[styles.dimensionValue, { color: colors.textPrimary }]}>
        {formatScore(value)}
      </Text>
      <Text style={[styles.dimensionLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    fontSize: 13,
    marginBottom: 2,
  },
  sectionCard: {
    marginBottom: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 24,
  },
  statusCard: {
    marginBottom: 16,
    alignItems: 'center',
    paddingVertical: 24,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 13,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 16,
  },
  totalScore: {
    fontSize: 42,
    fontWeight: '700',
  },
  scoreTier: {
    fontSize: 16,
  },
  dimensionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dimensionItem: {
    alignItems: 'center',
  },
  dimensionValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  dimensionLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  errorItem: {
    marginBottom: 12,
    paddingBottom: 12,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  errorOriginal: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  errorArrow: {
    fontSize: 14,
  },
  errorCorrected: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorExplanation: {
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
