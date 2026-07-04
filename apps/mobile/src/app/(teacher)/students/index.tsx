import { formatScore, getStudentTagLabel } from '@betterwrite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Loading } from '../../../components/ui/Loading';
import { type StudentListItem, fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

const tagVariants: Record<string, 'success' | 'info' | 'warning' | 'error' | 'secondary'> = {
  excellent: 'success',
  good: 'info',
  improving: 'warning',
  attention: 'error',
};

export default function TeacherStudentsPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ classId?: string }>();
  const { colors } = useTheme();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [classId, setClassId] = useState<string>(params.classId ?? '');
  const [keyword, setKeyword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetcher
      .listTeacherClasses()
      .then((res) => {
        if (res.success && res.data) {
          setClasses(res.data);
        }
      })
      .catch((err) => console.warn('[TeacherStudents] loadClasses error:', err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStudents(classId, keyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [classId, keyword]);

  const loadStudents = async (cid: string, kw: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const reqParams: { classId?: string; keyword?: string } = {};
      if (cid) reqParams.classId = cid;
      if (kw.trim()) reqParams.keyword = kw.trim();
      const res = await fetcher.listStudents(reqParams);
      if (res.success && res.data) {
        setStudents(res.data);
      } else {
        setStudents([]);
        setError(res.error ?? '获取学生失败');
        console.warn('[TeacherStudents] failed:', res.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setStudents([]);
      setError(message);
      console.error('[TeacherStudents] error:', message);
    } finally {
      setIsLoading(false);
    }
  };

  const classChips = useMemo(
    () => [{ id: '', name: '全部', grade: '', studentCount: 0 }, ...classes],
    [classes],
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>学生管理</Text>
      </View>

      <Input
        label="搜索"
        value={keyword}
        onChangeText={setKeyword}
        placeholder="姓名、学号或邮箱"
        colors={colors}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {classChips.map((cls) => (
          <Pressable
            key={cls.id || 'all'}
            onPress={() => setClassId(cls.id)}
            style={[
              styles.filterChip,
              {
                backgroundColor: classId === cls.id ? colors.accent : colors.bgSecondary,
                borderColor: classId === cls.id ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: classId === cls.id ? '#FFFFFF' : colors.textSecondary },
              ]}
            >
              {cls.id ? `${cls.grade} · ${cls.name}` : '全部'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <Card colors={colors} style={styles.errorCard}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </Card>
      ) : null}

      <Text style={[styles.countText, { color: colors.textTertiary }]}>
        共 {students.length} 人
      </Text>

      {isLoading ? (
        <Loading colors={colors} />
      ) : students.length === 0 ? (
        <Card colors={colors} style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>暂无学生</Text>
        </Card>
      ) : (
        students.map((student) => (
          <Pressable
            key={student.id}
            onPress={() => router.push(`/(teacher)/students/${student.id}`)}
            style={({ pressed }) => [
              styles.studentCard,
              { backgroundColor: colors.bgElevated, borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <View style={styles.studentHeader}>
              <View style={styles.studentInfo}>
                <Text style={[styles.studentName, { color: colors.textPrimary }]}>
                  {student.name}
                </Text>
                <Text
                  style={[styles.studentSub, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {student.email}
                </Text>
              </View>
              {student.tag ? (
                <Badge variant={tagVariants[student.tag] ?? 'secondary'} colors={colors}>
                  {getStudentTagLabel(student.tag)}
                </Badge>
              ) : null}
            </View>
            <View style={styles.studentFooter}>
              <Text style={[styles.studentMeta, { color: colors.textTertiary }]}>
                {student.grade} · {student.className}
                {student.studentNo ? ` · ${student.studentNo}` : ''}
              </Text>
              <View style={styles.statsRow}>
                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                  作文 {student.essayCount}
                </Text>
                <Text style={[styles.statText, { color: colors.accent }]}>
                  {formatScore(student.averageScore)} 分
                </Text>
              </View>
            </View>
          </Pressable>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  errorCard: {
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
  },
  countText: {
    fontSize: 12,
    marginBottom: 8,
  },
  emptyCard: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  studentCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  studentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
  },
  studentSub: {
    fontSize: 13,
    marginTop: 2,
  },
  studentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentMeta: {
    fontSize: 12,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
