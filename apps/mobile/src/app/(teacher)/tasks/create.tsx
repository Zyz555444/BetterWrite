import { TopicTypeLabels } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Loading } from '../../../components/ui/Loading';
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
}

export default function TeacherTaskCreatePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const [form, setForm] = useState({
    title: '',
    topicType: 'narration',
    requirements: '',
    keyPoints: '',
    classId: '',
    wordLimitMin: '80',
    wordLimitMax: '125',
    dueDate: '',
  });

  useEffect(() => {
    fetcher
      .listTeacherClasses()
      .then((res) => {
        if (res.success && res.data) {
          setClasses(res.data);
        }
      })
      .finally(() => setIsLoadingClasses(false));
  }, []);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const selectedClass = classes.find((c) => c.id === form.classId);
  const selectedTopicLabel =
    TopicTypeLabels[form.topicType as keyof typeof TopicTypeLabels] ?? form.topicType;

  const handleSubmit = async () => {
    setError(null);

    if (!form.title.trim()) {
      setError('请填写标题');
      return;
    }
    if (!form.classId) {
      setError('请选择班级');
      return;
    }
    if (!form.requirements.trim()) {
      setError('请填写写作要求');
      return;
    }

    const payload = {
      title: form.title.trim(),
      topicType: form.topicType,
      requirements: form.requirements.trim(),
      keyPoints: form.keyPoints
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      classId: form.classId,
      wordLimitMin: Number(form.wordLimitMin) || 80,
      wordLimitMax: Number(form.wordLimitMax) || 125,
      dueDate: form.dueDate || undefined,
    };

    setIsSubmitting(true);
    try {
      const res = await fetcher.createTask(payload);
      if (res.success && res.data) {
        router.back();
      } else {
        setError(res.error ?? '创建失败');
        console.warn('[TeacherTaskCreate] failed:', res.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建失败';
      setError(message);
      console.error('[TeacherTaskCreate] error:', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingClasses) return <Loading fullScreen colors={colors} />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bgPrimary }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>新建作文任务</Text>
          <Button
            title="取消"
            variant="ghost"
            size="sm"
            onPress={() => router.back()}
            colors={colors}
          />
        </View>

        {error ? (
          <Card colors={colors} style={styles.errorCard}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </Card>
        ) : null}

        <Input
          label="标题"
          value={form.title}
          onChangeText={(v) => handleChange('title', v)}
          placeholder="例如：My Favorite Season"
          colors={colors}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>班级</Text>
        <Pressable
          onPress={() => setShowClassPicker(true)}
          style={[
            styles.picker,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.pickerText,
              { color: selectedClass ? colors.textPrimary : colors.textTertiary },
            ]}
          >
            {selectedClass
              ? `${selectedClass.grade} · ${selectedClass.name}（${selectedClass.studentCount} 人）`
              : '选择班级'}
          </Text>
          <Text style={[styles.pickerArrow, { color: colors.textTertiary }]}>▼</Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.textSecondary }]}>体裁</Text>
        <Pressable
          onPress={() => setShowTopicPicker(true)}
          style={[
            styles.picker,
            { backgroundColor: colors.bgElevated, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.pickerText, { color: colors.textPrimary }]}>
            {selectedTopicLabel}
          </Text>
          <Text style={[styles.pickerArrow, { color: colors.textTertiary }]}>▼</Text>
        </Pressable>

        <View style={styles.row}>
          <View style={styles.half}>
            <Input
              label="最少词数"
              value={form.wordLimitMin}
              onChangeText={(v) => handleChange('wordLimitMin', v)}
              keyboardType="numeric"
              colors={colors}
            />
          </View>
          <View style={styles.half}>
            <Input
              label="最多词数"
              value={form.wordLimitMax}
              onChangeText={(v) => handleChange('wordLimitMax', v)}
              keyboardType="numeric"
              colors={colors}
            />
          </View>
        </View>

        <Input
          label="写作要求"
          value={form.requirements}
          onChangeText={(v) => handleChange('requirements', v)}
          placeholder="描述题目背景、写作要点和评分标准..."
          multiline
          colors={colors}
        />

        <Input
          label="评分要点（每行一条）"
          value={form.keyPoints}
          onChangeText={(v) => handleChange('keyPoints', v)}
          placeholder={'例如：\n包含至少两个季节特点\n使用恰当的连接词'}
          multiline
          colors={colors}
        />

        <Input
          label="截止时间（可选，格式 YYYY-MM-DDTHH:MM）"
          value={form.dueDate}
          onChangeText={(v) => handleChange('dueDate', v)}
          placeholder="2026-07-10T23:59"
          colors={colors}
        />

        <Button
          title={isSubmitting ? '创建中...' : '创建任务'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          colors={colors}
          style={styles.submitButton}
        />

        <Modal
          visible={showClassPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowClassPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowClassPicker(false)}>
            <View style={[styles.modalContent, { backgroundColor: colors.bgElevated }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择班级</Text>
              <ScrollView>
                {classes.map((cls) => (
                  <Pressable
                    key={cls.id}
                    onPress={() => {
                      handleChange('classId', cls.id);
                      setShowClassPicker(false);
                    }}
                    style={[
                      styles.modalItem,
                      form.classId === cls.id && { backgroundColor: colors.accentLight },
                    ]}
                  >
                    <Text style={[styles.modalItemText, { color: colors.textPrimary }]}>
                      {cls.grade} · {cls.name}（{cls.studentCount} 人）
                    </Text>
                    {form.classId === cls.id ? <Badge colors={colors}>已选</Badge> : null}
                  </Pressable>
                ))}
              </ScrollView>
              <Button
                title="关闭"
                variant="secondary"
                onPress={() => setShowClassPicker(false)}
                colors={colors}
                style={styles.modalClose}
              />
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showTopicPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTopicPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowTopicPicker(false)}>
            <View style={[styles.modalContent, { backgroundColor: colors.bgElevated }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>选择体裁</Text>
              <ScrollView>
                {Object.entries(TopicTypeLabels).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      handleChange('topicType', value);
                      setShowTopicPicker(false);
                    }}
                    style={[
                      styles.modalItem,
                      form.topicType === value && { backgroundColor: colors.accentLight },
                    ]}
                  >
                    <Text style={[styles.modalItemText, { color: colors.textPrimary }]}>
                      {label}
                    </Text>
                    {form.topicType === value ? <Badge colors={colors}>已选</Badge> : null}
                  </Pressable>
                ))}
              </ScrollView>
              <Button
                title="关闭"
                variant="secondary"
                onPress={() => setShowTopicPicker(false)}
                colors={colors}
                style={styles.modalClose}
              />
            </View>
          </Pressable>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
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
    fontSize: 22,
    fontWeight: '700',
  },
  errorCard: {
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 12,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    minHeight: 44,
  },
  pickerText: {
    fontSize: 16,
  },
  pickerArrow: {
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  half: {
    flex: 1,
  },
  submitButton: {
    marginTop: 24,
    marginBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalItemText: {
    fontSize: 15,
  },
  modalClose: {
    marginTop: 12,
  },
});
