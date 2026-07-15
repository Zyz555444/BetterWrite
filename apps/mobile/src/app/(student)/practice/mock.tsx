import { type QuestionBankItem, countWords, getTopicTypeLabel } from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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

const MOCK_TOTAL_SECONDS = 15 * 60;

interface FeedbackError {
  original: string;
  corrected: string;
  type: string;
  explanation: string;
}

export default function StudentPracticeMockPage() {
  const router = useRouter();
  const { colors } = useTheme();

  const [question, setQuestion] = useState<QuestionBankItem | null>(null);
  const [content, setContent] = useState('');
  const [remaining, setRemaining] = useState(MOCK_TOTAL_SECONDS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [feedbackErrors, setFeedbackErrors] = useState<FeedbackError[] | null>(null);

  const contentRef = useRef(content);
  const remainingRef = useRef(remaining);
  const autoSubmitTriedRef = useRef(false);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    remainingRef.current = remaining;
  }, [remaining]);

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    fetcher
      .getQuestions({ limit: 50 })
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          const picked = res.data[Math.floor(Math.random() * res.data.length)];
          setQuestion(picked);
        } else {
          setLoadError(res.error ?? '题库为空，无法开始模拟');
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : '获取题目失败'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!question || hasSubmitted) return;
    const timer = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [question, hasSubmitted]);

  const handleSubmit = useCallback(async () => {
    if (hasSubmitted || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    const durationMs = (MOCK_TOTAL_SECONDS - remainingRef.current) * 1000;
    const body: {
      content: string;
      durationMs: number;
      exerciseType: string;
      questionId?: string;
    } = {
      content: contentRef.current,
      durationMs,
      exerciseType: 'timed_mock',
    };
    if (question) body.questionId = question.id;
    try {
      const res = await fetcher.submitPractice(body);
      if (res.success && res.data) {
        setFeedbackErrors(res.data.feedback.errors);
        setHasSubmitted(true);
      } else {
        setError(res.error ?? '提交失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setIsSubmitting(false);
    }
  }, [hasSubmitted, isSubmitting, question]);

  useEffect(() => {
    if (remaining === 0 && !hasSubmitted && !isSubmitting && !autoSubmitTriedRef.current) {
      autoSubmitTriedRef.current = true;
      handleSubmit();
    }
  }, [remaining, hasSubmitted, isSubmitting, handleSubmit]);

  const handleExit = () => {
    Alert.alert('退出模拟', '确定要退出本次限时模拟吗？已输入的内容将丢失。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: () => {
          router.replace('/(student)/practice');
        },
      },
    ]);
  };

  const wordCount = countWords(content);
  const elapsed = MOCK_TOTAL_SECONDS - remaining;

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  const remainingLow = remaining < 60 && remaining > 0;

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
                    限时模拟
                  </Badge>
                  <Badge variant="outline" colors={colors}>
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
              <View style={styles.timeBox}>
                <Text
                  style={[
                    styles.remainingValue,
                    { color: remainingLow ? colors.error : colors.textPrimary },
                  ]}
                >
                  {formatTime(remaining)}
                </Text>
                <Text style={[styles.remainingLabel, { color: colors.textTertiary }]}>
                  剩余时间
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
                editable={!hasSubmitted}
                style={[
                  styles.textarea,
                  { color: colors.textPrimary, backgroundColor: colors.bgElevated },
                ]}
                spellCheck={false}
                autoCapitalize="none"
              />
              <View style={styles.wordCountRow}>
                <Text style={[styles.wordCountText, { color: colors.textSecondary }]}>
                  词数：{wordCount} / {question.wordLimitMin}-{question.wordLimitMax}
                </Text>
              </View>
            </Card>

            {error ? (
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            ) : null}

            {!hasSubmitted && (
              <View style={styles.actions}>
                <Button title="退出模拟" variant="ghost" onPress={handleExit} colors={colors} />
                <Button
                  title={isSubmitting ? '提交中...' : '提前提交'}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={isSubmitting || wordCount < 10}
                  colors={colors}
                />
              </View>
            )}

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
                <Button
                  title="返回练习首页"
                  variant="secondary"
                  onPress={handleExit}
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
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
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
  timeBox: {
    alignItems: 'center',
    minWidth: 90,
  },
  remainingValue: {
    fontSize: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  remainingLabel: {
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
  wordCountRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  wordCountText: {
    fontSize: 13,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
