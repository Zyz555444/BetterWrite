import { formatScore, getStudentTagLabel, getTopicTypeLabel } from '@betterwrite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { type StudentDetail, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

const statusLabels: Record<string, string> = {
  pending: '等待批改',
  correcting: '批改中',
  completed: '已完成',
  failed: '批改失败',
};

const tagVariants: Record<string, 'success' | 'info' | 'warning' | 'error' | 'secondary'> = {
  excellent: 'success',
  good: 'info',
  improving: 'warning',
  attention: 'error',
};

export default function TeacherStudentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[TeacherStudentDetail] loading id=${id}`);
    setIsLoading(true);
    setError(null);
    fetcher
      .getStudentDetail(id)
      .then((res) => {
        if (res.success && res.data) {
          setStudent(res.data);
          console.log(`[TeacherStudentDetail] loaded essayCount=${res.data.essayCount}`);
        } else {
          setError(res.error ?? '获取学生失败');
          console.warn('[TeacherStudentDetail] failed:', res.error);
        }
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : '加载失败';
        setError(message);
        console.error('[TeacherStudentDetail] error:', message);
      })
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (error || !student) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.bgPrimary }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error ?? '学生不存在'}</Text>
        <Button title="返回" variant="ghost" onPress={() => router.back()} colors={colors} />
      </View>
    );
  }

  const classText =
    student.classes.length > 0
      ? student.classes
          .map((c) => (c.name ? `${c.grade ?? ''} · ${c.name}` : (c.grade ?? '-')))
          .join('，')
      : '-';

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Button
        title="返回学生列表"
        variant="ghost"
        size="sm"
        onPress={() => router.back()}
        colors={colors}
      />

      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{student.name}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>学生详情</Text>
        </View>
        {student.tag ? (
          <Badge variant={tagVariants[student.tag] ?? 'secondary'} colors={colors}>
            {getStudentTagLabel(student.tag)}
          </Badge>
        ) : null}
      </View>

      <Card colors={colors} style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>基本信息</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>姓名</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{student.name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>学号</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
            {student.studentNo ?? '-'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>邮箱</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]} numberOfLines={1}>
            {student.email}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>班级</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{classText}</Text>
        </View>
      </Card>

      <View style={styles.statsRow}>
        <Card colors={colors} style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>作文数</Text>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {student.essayCount}
          </Text>
        </Card>
        <Card colors={colors} style={styles.statCard}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>平均分</Text>
          <Text style={[styles.statValue, { color: colors.accent }]}>
            {formatScore(student.averageScore)}
          </Text>
        </Card>
      </View>

      <Card colors={colors} style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          近期作文（{student.recentEssays.length} 篇）
        </Text>
        {student.recentEssays.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无作文记录</Text>
        ) : (
          student.recentEssays.map((essay) => (
            <Pressable
              key={essay.id}
              onPress={() => router.push(`/(teacher)/essays/${essay.id}`)}
              style={({ pressed }) => [
                styles.essayItem,
                { backgroundColor: colors.bgSecondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={styles.essayHeader}>
                <Text style={[styles.essayTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {essay.title || '未命名作文'}
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
                  {statusLabels[essay.status] ?? essay.status}
                </Badge>
              </View>
              <View style={styles.essayFooter}>
                <Text style={[styles.essayMeta, { color: colors.textSecondary }]}>
                  {getTopicTypeLabel(essay.topicType ?? '')} · {essay.wordCount} 词
                </Text>
                {essay.status === 'completed' ? (
                  <Text style={[styles.essayScore, { color: colors.accent }]}>
                    {formatScore(essay.totalScore)} 分
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.essayDate, { color: colors.textTertiary }]}>
                {new Date(essay.submittedAt).toLocaleString()}
              </Text>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  errorText: {
    fontSize: 15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
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
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  essayItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
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
    fontWeight: '500',
  },
  essayFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  essayMeta: {
    fontSize: 13,
  },
  essayScore: {
    fontSize: 14,
    fontWeight: '600',
  },
  essayDate: {
    fontSize: 12,
  },
});
