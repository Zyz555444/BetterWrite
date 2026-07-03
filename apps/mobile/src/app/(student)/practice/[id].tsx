import { type QuestionBankItem, countWords, getTopicTypeLabel } from '@betterwrite/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

interface FeedbackError {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

export default function StudentPracticeItemPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();

  const [question, setQuestion] = useState<QuestionBankItem | null>(null);
  const [content, setContent] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeepSubmitting, setIsDeepSubmitting] = useState(false);
  const [feedbackErrors, setFeedbackErrors] = useState<FeedbackError[] | null>(null);

  useEffect(() => {
    console.log(`[StudentPracticeItem] mount id=${id}`);
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    fetcher
      .getQuestion(id)
      .then((res) => {
        if (res.success && res.data) {
          setQuestion(res.data);
          console.log(`[StudentPracticeItem] question loaded title=${res.data.title}`);
        } else {
          setLoadError(res.error ?? '获取题目失败');
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : '获取题目失败'))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const wordCount = countWords(content);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmit = async () => {
    if (!question) return;
    const minWords = question.wordLimitMin;
    if (wordCount < minWords) {
      setLoadError(`字数不足，建议至少 ${minWords} 词`);
      return;
    }
    setIsSubmitting(true);
    setLoadError(null);
    try {
      const res = await fetcher.submitPractice({
        questionId: id,
        content,
        durationMs: elapsed * 1000,
        exerciseType: 'question_bank',
      });
      if (res.success && res.data) {
        setFeedbackErrors(res.data.feedback.errors);
        console.log(`[StudentPracticeItem] submit ok errors=${res.data.feedback.errors.length}`);
      } else {
        setLoadError(res.error ?? '提交失败');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeepSubmit = async () => {
    if (!question) return;
    setIsDeepSubmitting(true);
    setLoadError(null);
    try {
      const res = await fetcher.submitPracticeDeep({
        questionId: id,
        content,
        durationMs: elapsed * 1000,
        exerciseType: 'question_bank',
      });
      if (res.success && res.data) {
        console.log(`[StudentPracticeItem] deep submit ok essayId=${res.data.essayId}`);
        router.replace(`/(student)/essays/${res.data.essayId}`);
      } else {
        setLoadError(res.error ?? '深度批改提交失败');
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '深度批改提交失败');
    } finally {
      setIsDeepSubmitting(false);
    }
  };

  if (isLoading) return <Loading fullScreen colors={colors} />;
  if (loadError && !question) return <Loading fullScreen colors={colors} />;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {question ? (
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.badgeRow}>
                  <Badge variant="secondary" colors={colors}>
                    {getTopicTypeLabel(question.topicType)}
                  </Badge>
                  <Text style={[styles.timerText, { color: colors.textSecondary }]}>
                    已用 {formatTime(elapsed)}
                  </Text>
                </View>
                <Text style={[styles.title, { color: colors.textPrimary }]}>{question.title}</Text>
                <Text style={[styles.requirements, { color: colors.textSecondary }]}>
                  {question.requirements}
                </Text>
              </View>
              <View style={styles.wordCountBox}>
                <Text style={[styles.wordCountValue, { color: colors.textPrimary }]}>
                  {wordCount}
                </Text>
                <Text style={[styles.wordCountLabel, { color: colors.textSecondary }]}>
                  词 / {question.wordLimitMin}-{question.wordLimitMax}
                </Text>
              </View>
            </View>

            {question.keyPoints && question.keyPoints.length > 0 && (
              <Card colors={colors} style={styles.pointsCard}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>写作要点</Text>
                {question.keyPoints.map((kp) => (
                  <Text key={kp} style={[styles.pointText, { color: colors.textSecondary }]}>
                    • {kp}
                  </Text>
                ))}
              </Card>
            )}

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

            {loadError ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{loadError}</Text>
            ) : null}

            <Button
              title={isSubmitting ? '提交中...' : '提交并即时反馈'}
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting || wordCount < 10}
              colors={colors}
            />

            {feedbackErrors !== null && (
              <Card colors={colors} style={styles.feedbackCard}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>即时反馈</Text>
                {feedbackErrors.length === 0 ? (
                  <Text style={[styles.successText, { color: colors.success }]}>
                    很棒，未发现语法错误
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.feedbackDesc, { color: colors.textSecondary }]}>
                      发现 {feedbackErrors.length} 处可改进，以下为修改建议：
                    </Text>
                    {feedbackErrors.map((err, idx) => (
                      <View
                        key={`${err.original}-${err.corrected}-${idx}`}
                        style={styles.errorItem}
                      >
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
                        <Text style={[styles.errorExplanation, { color: colors.textTertiary }]}>
                          {err.explanation}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.deepHint, { color: colors.textTertiary }]}>
                  需要更详细的评分与建议？尝试深度批改，将由 AI 给出完整四维度评分。
                </Text>
                <Button
                  title={isDeepSubmitting ? '提交中...' : '深度批改'}
                  variant="secondary"
                  onPress={handleDeepSubmit}
                  loading={isDeepSubmitting}
                  disabled={isDeepSubmitting}
                  colors={colors}
                />
              </Card>
            )}
          </>
        ) : null}
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timerText: {
    fontSize: 13,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  requirements: {
    fontSize: 14,
    lineHeight: 20,
  },
  wordCountBox: {
    alignItems: 'center',
    minWidth: 80,
  },
  wordCountValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  wordCountLabel: {
    fontSize: 12,
  },
  pointsCard: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  pointText: {
    fontSize: 14,
    lineHeight: 20,
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
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  feedbackCard: {
    gap: 12,
  },
  successText: {
    fontSize: 14,
  },
  feedbackDesc: {
    fontSize: 14,
  },
  errorItem: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
    gap: 6,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  divider: {
    height: 1,
    marginVertical: 4,
  },
  deepHint: {
    fontSize: 13,
    lineHeight: 18,
  },
});
