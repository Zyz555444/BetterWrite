import {
  type PracticeExercise,
  type QuestionBankItem,
  TopicTypeLabels,
  formatScore,
  getTopicTypeLabel,
} from '@betterwrite/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Empty } from '../../../components/ui/Empty';
import { Loading } from '../../../components/ui/Loading';
import { fetcher } from '../../../lib/api/fetcher';
import { useTheme } from '../../../theme/dark-mode';

const difficultyLabels: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

type TabKey = 'bank' | 'mock' | 'history';

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: 'bank', label: '题库练习' },
  { key: 'mock', label: '限时模拟' },
  { key: 'history', label: '练习历史' },
];

export default function StudentPracticePage() {
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<TabKey>('bank');

  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [topicType, setTopicType] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [isLoadingBank, setIsLoadingBank] = useState(true);
  const [bankError, setBankError] = useState<string | null>(null);

  const [history, setHistory] = useState<PracticeExercise[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {}, []);

  useEffect(() => {
    setIsLoadingBank(true);
    setBankError(null);
    const params: { topicType?: string; difficulty?: string; limit: number } = { limit: 50 };
    if (topicType) params.topicType = topicType;
    if (difficulty) params.difficulty = difficulty;
    fetcher
      .getQuestionBank(params)
      .then((res) => {
        if (res.success && res.data) {
          setQuestions(res.data);
        } else {
          setBankError(res.error ?? '获取题库失败');
        }
      })
      .catch((err) => setBankError(err instanceof Error ? err.message : '获取题库失败'))
      .finally(() => setIsLoadingBank(false));
  }, [topicType, difficulty]);

  const loadHistory = useCallback(() => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    fetcher
      .getPracticeHistory({ limit: 20 })
      .then((res) => {
        if (res.success && res.data) {
          setHistory(res.data);
        } else {
          setHistoryError(res.error ?? '获取历史失败');
        }
      })
      .catch((err) => setHistoryError(err instanceof Error ? err.message : '获取历史失败'))
      .finally(() => setIsLoadingHistory(false));
  }, []);

  useEffect(() => {
    if (tab !== 'history' || hasLoadedHistory) return;
    setHasLoadedHistory(true);
    loadHistory();
  }, [tab, hasLoadedHistory, loadHistory]);

  const handleStart = (id: string) => {
    router.push(`/(student)/practice/${id}`);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>自主练习</Text>

      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Button
            key={t.key}
            title={t.label}
            variant={tab === t.key ? 'primary' : 'secondary'}
            size="sm"
            onPress={() => setTab(t.key)}
            colors={colors}
          />
        ))}
      </View>

      {tab === 'bank' && (
        <View style={styles.tabPanel}>
          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.filterGroup}>
                <Button
                  title={topicType ? getTopicTypeLabel(topicType) : '全部话题'}
                  variant={topicType ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() =>
                    setTopicType((prev) => {
                      const keys = Object.keys(TopicTypeLabels);
                      const idx = keys.indexOf(prev);
                      return keys[idx + 1] ?? '';
                    })
                  }
                  colors={colors}
                />
                <Button
                  title={difficulty ? (difficultyLabels[difficulty] ?? difficulty) : '全部难度'}
                  variant={difficulty ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() =>
                    setDifficulty((prev) => {
                      const keys = Object.keys(difficultyLabels);
                      const idx = keys.indexOf(prev);
                      return keys[idx + 1] ?? '';
                    })
                  }
                  colors={colors}
                />
              </View>
            </ScrollView>
          </View>

          {isLoadingBank && <Loading colors={colors} />}
          {bankError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{bankError}</Text>
          ) : null}

          {!isLoadingBank && questions.length === 0 && (
            <Empty title="暂无题目" description="题库中暂无符合条件的题目" colors={colors} />
          )}

          {questions.map((q) => (
            <Card key={q.id} colors={colors} style={styles.questionCard}>
              <View style={styles.questionHeader}>
                <Badge variant="secondary" colors={colors}>
                  {getTopicTypeLabel(q.topicType)}
                </Badge>
                <Badge variant="outline" colors={colors}>
                  {difficultyLabels[q.difficulty] ?? q.difficulty}
                </Badge>
              </View>
              <Text style={[styles.questionTitle, { color: colors.textPrimary }]}>{q.title}</Text>
              <Text
                style={[styles.questionRequirements, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {q.requirements}
              </Text>
              <View style={styles.questionMeta}>
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                  {q.wordLimitMin}-{q.wordLimitMax} 词
                </Text>
                {q.timeLimitMinutes ? (
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                    限时 {q.timeLimitMinutes} 分钟
                  </Text>
                ) : null}
              </View>
              <Button
                title="开始练习"
                size="sm"
                onPress={() => handleStart(q.id)}
                colors={colors}
              />
            </Card>
          ))}
        </View>
      )}

      {tab === 'mock' && (
        <Card colors={colors} style={styles.mockCard}>
          <Text style={[styles.mockTitle, { color: colors.textPrimary }]}>限时模拟</Text>
          <Text style={[styles.mockDesc, { color: colors.textSecondary }]}>
            系统将从题库中随机抽取一道题目，你需要在 15
            分钟内完成写作，模拟真实考场环境。倒计时结束将自动提交。
          </Text>
          <View style={styles.mockMeta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>限时 15 分钟</Text>
          </View>
          <Button
            title="开始模拟"
            onPress={() => router.push('/(student)/practice/mock')}
            colors={colors}
          />
        </Card>
      )}

      {tab === 'history' && (
        <View style={styles.tabPanel}>
          {isLoadingHistory && <Loading colors={colors} />}
          {historyError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{historyError}</Text>
          ) : null}
          {!isLoadingHistory && !historyError && history.length === 0 && (
            <Empty title="还没有练习记录" description="完成练习后将在此展示" colors={colors} />
          )}
          {history.map((item) => (
            <Card key={item.id} colors={colors} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={styles.historyBadges}>
                  {item.topicType ? (
                    <Badge variant="secondary" colors={colors}>
                      {getTopicTypeLabel(item.topicType)}
                    </Badge>
                  ) : null}
                  <Badge variant="outline" colors={colors}>
                    {item.exerciseType === 'timed_mock' ? '限时模拟' : '题库练习'}
                  </Badge>
                </View>
                <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleDateString()
                    : new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.historyTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.title ?? '未命名练习'}
              </Text>
              <Text
                style={[styles.historyPreview, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {item.content}
              </Text>
              <View style={styles.historyScoreRow}>
                <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>
                  {formatScore(item.score)}
                </Text>
                <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>/ 15</Text>
                <Text style={[styles.wordCountText, { color: colors.textTertiary }]}>
                  {item.wordCount ?? '-'} 词
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
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
    marginBottom: 16,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabPanel: {
    gap: 12,
  },
  filters: {
    marginBottom: 8,
  },
  filterGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  questionCard: {
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  questionRequirements: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  questionMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
  },
  mockCard: {
    gap: 12,
  },
  mockTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  mockDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  mockMeta: {
    marginBottom: 4,
  },
  historyCard: {
    marginBottom: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  historyDate: {
    fontSize: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyPreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  historyScoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  scoreLabel: {
    fontSize: 12,
    marginLeft: 4,
  },
  wordCountText: {
    fontSize: 12,
    marginLeft: 'auto',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 8,
  },
});
