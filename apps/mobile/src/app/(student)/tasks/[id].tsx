import { countWords, getTopicTypeLabel } from '@betterwrite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Loading } from '../../../components/ui/Loading';
import { type EssayTask, fetcher } from '../../../lib/api/fetcher';
import { OcrCameraModal, type OcrResult } from '../../../lib/camera/ocr-camera';
import { loadDraftWithSync, saveLocalDraft } from '../../../lib/storage/draft-storage';
import { useTheme } from '../../../theme/dark-mode';

const STANDALONE_ID = 'standalone';
const DEFAULT_MIN = 80;
const DEFAULT_MAX = 125;

export default function TaskWritePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const isStandalone = id === STANDALONE_ID;

  const [task, setTask] = useState<EssayTask | null>(null);
  const [taskLoading, setTaskLoading] = useState(!isStandalone);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordLimitMin = task?.wordLimitMin ?? DEFAULT_MIN;
  const wordLimitMax = task?.wordLimitMax ?? DEFAULT_MAX;
  const wordCount = useMemo(() => countWords(content), [content]);
  const durationMs = 0; // Simplified for mobile v1

  useEffect(() => {
    if (isStandalone) {
      setTask(null);
      return;
    }
    fetcher
      .getTask(id)
      .then((res) => {
        if (res.success && res.data) {
          setTask(res.data);
        } else {
          setTaskError(res.error ?? '获取任务失败');
        }
      })
      .catch((err) => setTaskError(err instanceof Error ? err.message : '获取任务失败'))
      .finally(() => setTaskLoading(false));
  }, [id, isStandalone]);

  useEffect(() => {
    if (draftRestored) return;
    loadDraftWithSync(id)
      .then((draft) => {
        if (draft?.content) {
          setContent(draft.content);
        }
      })
      .catch((err) => console.warn('[TaskWrite] draft restore error:', err))
      .finally(() => setDraftRestored(true));
  }, [id, draftRestored]);

  useEffect(() => {
    if (!draftRestored || !content) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveLocalDraft(id, { content, wordCount, durationMs }).catch((err) =>
        console.warn('[TaskWrite] auto-save error:', err),
      );
    }, 5000);
    return () => {
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    };
  }, [content, id, wordCount, draftRestored]);

  const handleSaveDraft = async () => {
    setIsSaving(true);
    try {
      await saveLocalDraft(id, { content, wordCount, durationMs });
      await fetcher.saveDraft(id, { content, wordCount, durationMs });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      console.warn('[TaskWrite] save draft error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (wordCount < wordLimitMin) {
      setSubmitError(`字数不足，建议至少 ${wordLimitMin} 词`);
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetcher.submitEssay({
        content,
        taskId: isStandalone ? undefined : id,
        title: isStandalone ? '自由写作' : undefined,
      });
      if (res.success && res.data) {
        router.replace(`/(student)/essays/${res.data.id}`);
      } else {
        setSubmitError(res.error ?? '提交失败');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOcrResult = useCallback((result: OcrResult) => {
    if (!result.content || result.content.trim().length === 0) {
      setOcrWarning('未识别到有效文字，请重新拍照或手动输入');
      return;
    }
    setContent((prev) => {
      const merged =
        prev && prev.trim().length > 0 ? `${prev}\n\n${result.content}` : result.content;
      return merged;
    });
    setOcrWarning(null);
  }, []);

  if (taskLoading) return <Loading fullScreen colors={colors} />;
  if (taskError) return <Loading fullScreen colors={colors} />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Badge variant="secondary" colors={colors}>
              {isStandalone ? '自由写作' : getTopicTypeLabel(task?.topicType ?? '') || '写作'}
            </Badge>
            {justSaved ? (
              <Text style={[styles.savedText, { color: colors.success }]}>已保存</Text>
            ) : null}
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {isStandalone ? '自由写作' : (task?.title ?? '作文任务')}
          </Text>
          <Text style={[styles.requirements, { color: colors.textSecondary }]}>
            {isStandalone ? '请根据自己想练习的主题完成一篇英语作文。' : (task?.requirements ?? '')}
          </Text>
        </View>

        <View style={styles.wordCountBox}>
          <Text style={[styles.wordCountValue, { color: colors.textPrimary }]}>{wordCount}</Text>
          <Text style={[styles.wordCountLabel, { color: colors.textSecondary }]}>
            词 / {wordLimitMin}-{wordLimitMax}
          </Text>
        </View>

        <Card colors={colors} style={styles.editorCard}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="在此输入你的英语作文..."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            style={[
              styles.textarea,
              { color: colors.textPrimary, backgroundColor: colors.bgElevated },
            ]}
            spellCheck={false}
            autoCapitalize="none"
          />
        </Card>

        <Card colors={colors} style={styles.tipsCard}>
          <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>字数提示</Text>
          <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
            深圳中考英语作文建议词数为 100-125 词，{wordLimitMin} 词为底线。
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.bgTertiary }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor:
                    wordCount < wordLimitMin
                      ? colors.error
                      : wordCount <= wordLimitMax
                        ? colors.success
                        : colors.warning,
                  width: `${Math.min(100, (wordCount / 150) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.tipsText, { color: colors.textTertiary }]}>
            {wordCount < wordLimitMin && '字数偏少，建议补充内容'}
            {wordCount >= wordLimitMin && wordCount <= wordLimitMax && '字数适宜'}
            {wordCount > wordLimitMax && '字数偏多，注意控制'}
          </Text>
        </Card>

        {submitError ? (
          <Text style={[styles.errorText, { color: colors.error }]}>{submitError}</Text>
        ) : null}

        {ocrWarning ? (
          <View style={[styles.ocrWarningBox, { backgroundColor: colors.accentLight }]}>
            <Text style={[styles.ocrWarningText, { color: colors.warning }]}>{ocrWarning}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={isSaving ? '保存中...' : justSaved ? '已保存' : '保存草稿'}
            variant="secondary"
            onPress={handleSaveDraft}
            disabled={isSaving || !content}
            colors={colors}
          />
          <Button
            title={isSubmitting ? '提交中...' : '提交作文'}
            onPress={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || wordCount < wordLimitMin}
            colors={colors}
          />
        </View>

        <Button
          title="拍照识别手写"
          variant="outline"
          onPress={() => {
            setOcrWarning(null);
            setShowOcr(true);
          }}
          colors={colors}
        />
      </ScrollView>

      <OcrCameraModal
        visible={showOcr}
        taskId={isStandalone ? undefined : id}
        colors={colors}
        onClose={() => setShowOcr(false)}
        onResult={handleOcrResult}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  savedText: {
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  requirements: {
    fontSize: 14,
    lineHeight: 20,
  },
  wordCountBox: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  wordCountValue: {
    fontSize: 36,
    fontWeight: '700',
  },
  wordCountLabel: {
    fontSize: 13,
  },
  editorCard: {
    padding: 0,
    overflow: 'hidden',
  },
  textarea: {
    minHeight: 260,
    padding: 16,
    fontSize: 16,
    lineHeight: 24,
  },
  tipsCard: {
    gap: 8,
  },
  tipsTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  tipsText: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  ocrWarningBox: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  ocrWarningText: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});
