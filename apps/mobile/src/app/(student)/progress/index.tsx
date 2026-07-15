import { type Achievement, type StudentProgress, formatScore } from '@betterwrite/shared';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart, RadarChart } from '../../../components/charts';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

const levelConfig: Record<StudentProgress['level'], { label: string; color: string }> = {
  basic: { label: '基础', color: '#8A8A8A' },
  improving: { label: '进阶', color: '#2563EB' },
  advanced: { label: '拔尖', color: '#CA8A04' },
};

const tierConfig: Record<
  Achievement['tier'],
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  bronze: { label: '铜', color: '#CD7F32', icon: 'medal' },
  silver: { label: '银', color: '#C0C0C0', icon: 'medal' },
  gold: { label: '金', color: '#FFD700', icon: 'trophy' },
  platinum: { label: '铂', color: '#3B82F6', icon: 'trophy' },
};

export default function StudentProgressPage() {
  const { colors } = useTheme();
  const [progress, setProgress] = useState<StudentProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    fetcher
      .getStudentProgress()
      .then((res) => {
        if (res.success && res.data) {
          setProgress(res.data);
        } else {
          console.warn('[StudentProgress] getStudentProgress failed:', res.error);
          setError(res.error ?? '获取成长报告失败');
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        console.error('[StudentProgress] getStudentProgress error:', message);
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (error || !progress)
    return <Empty title="加载失败" description={error ?? '无法获取成长报告'} colors={colors} />;
  if (progress.totalEssays === 0) {
    return (
      <Empty
        title="完成第一篇作文"
        description="完成第一篇作文后即可查看成长报告"
        colors={colors}
      />
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>写作成长</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        四维能力、进步曲线与成就勋章
      </Text>

      <View style={styles.statsRow}>
        <Card colors={colors} style={styles.statCard}>
          <Ionicons name="document-text" size={18} color={colors.textTertiary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {progress.totalEssays}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>总作文数</Text>
        </Card>
        <Card colors={colors} style={styles.statCard}>
          <Ionicons name="ribbon" size={18} color={colors.textTertiary} />
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {formatScore(progress.averageScore)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>平均分</Text>
        </Card>
        <Card colors={colors} style={styles.statCard}>
          <Ionicons name="medal" size={18} color={colors.textTertiary} />
          <Badge
            variant="outline"
            colors={colors}
            style={{ borderColor: levelConfig[progress.level].color }}
          >
            <Text style={{ color: levelConfig[progress.level].color }}>
              {levelConfig[progress.level].label}
            </Text>
          </Badge>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>写作等级</Text>
        </Card>
      </View>

      <View style={styles.chartsRow}>
        <Card colors={colors} style={[styles.chartCard, styles.chartHalf]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>四维能力</Text>
          <RadarChart data={progress.radarData} size={220} />
        </Card>
        <Card colors={colors} style={[styles.chartCard, styles.chartHalf]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>进步曲线</Text>
          {progress.progressCurve.length === 0 ? (
            <Text style={[styles.emptyChartText, { color: colors.textSecondary }]}>
              暂无批改记录
            </Text>
          ) : (
            <LineChart data={progress.progressCurve} height={200} />
          )}
        </Card>
      </View>

      <Card colors={colors} style={styles.rankCard}>
        <View style={styles.rankHeader}>
          <Ionicons name="podium" size={18} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
            班级排名
          </Text>
        </View>
        {progress.rank === null ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无排名数据</Text>
        ) : (
          <>
            <View style={styles.rankRow}>
              <Text style={[styles.rankValue, { color: colors.textPrimary }]}>
                {progress.rank.classRank}
              </Text>
              <Text style={[styles.rankTotal, { color: colors.textSecondary }]}>
                / {progress.rank.total}
              </Text>
              <Text style={[styles.rankPercentile, { color: colors.textSecondary }]}>
                击败 {progress.rank.percentile}% 同学
              </Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.bgTertiary }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accent, width: `${progress.rank.percentile}%` },
                ]}
              />
            </View>
          </>
        )}
      </Card>

      <Card colors={colors} style={styles.achievementsCard}>
        <View style={styles.achievementsHeader}>
          <Ionicons name="trophy" size={18} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
            成就勋章
          </Text>
          <Text style={[styles.achievementsCount, { color: colors.textSecondary }]}>
            共 {progress.achievements.length} 枚
          </Text>
        </View>
        {progress.achievements.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无勋章</Text>
        ) : (
          <View style={styles.achievementsGrid}>
            {progress.achievements.map((achievement) => {
              const tier = tierConfig[achievement.tier];
              return (
                <View key={achievement.id} style={styles.achievementItem}>
                  <View
                    style={[
                      styles.achievementIcon,
                      { backgroundColor: `${tier.color}20`, borderColor: tier.color },
                    ]}
                  >
                    <Ionicons name={tier.icon} size={24} color={tier.color} />
                  </View>
                  <Text
                    style={[styles.achievementTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                  >
                    {achievement.title}
                  </Text>
                  <Text
                    style={[styles.achievementDesc, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    {achievement.description ?? tier.label}
                  </Text>
                </View>
              );
            })}
          </View>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
  },
  chartsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  chartCard: {
    alignItems: 'center',
  },
  chartHalf: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  emptyChartText: {
    fontSize: 14,
    height: 200,
    textAlignVertical: 'center',
  },
  rankCard: {
    marginBottom: 16,
    gap: 12,
  },
  rankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rankValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  rankTotal: {
    fontSize: 14,
  },
  rankPercentile: {
    fontSize: 13,
    marginLeft: 'auto',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  achievementsCard: {
    marginBottom: 16,
    gap: 12,
  },
  achievementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  achievementsCount: {
    fontSize: 13,
    marginLeft: 'auto',
  },
  emptyText: {
    fontSize: 14,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementItem: {
    width: '30%',
    alignItems: 'center',
    gap: 4,
  },
  achievementIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  achievementTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
});
