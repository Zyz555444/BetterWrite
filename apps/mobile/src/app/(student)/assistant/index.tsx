import type { AiAssistantResult, AiConversation } from '@betterwrite/shared';
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

type Mode = 'polish' | 'upgrade' | 'synonym' | 'grammar';

interface ModeConfig {
  title: string;
  description: string;
  placeholder: string;
}

const modeConfigs: Record<Mode, ModeConfig> = {
  polish: {
    title: 'AI 润色',
    description: '优化表达，不改变原意',
    placeholder: '粘贴你的英文段落...',
  },
  upgrade: {
    title: '句型升级',
    description: '将简单句升级为高级句式',
    placeholder: '粘贴需要升级的句子...',
  },
  synonym: {
    title: '同义词推荐',
    description: '替换基础词汇为高级词汇',
    placeholder: '输入单词，可加上下文，如：important | It is important to...',
  },
  grammar: {
    title: '语法检查',
    description: '检查语法错误并给出修改建议',
    placeholder: '粘贴需要检查的英文...',
  },
};

const modeLabels: Record<Mode, string> = {
  polish: '润色',
  upgrade: '句型升级',
  synonym: '同义词',
  grammar: '语法检查',
};

const modeOrder: Mode[] = ['polish', 'upgrade', 'synonym', 'grammar'];

interface DetailRow {
  label: string;
  value: string;
}

interface AiResponse {
  success: boolean;
  data?: AiAssistantResult;
  error?: string;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function isAiNotConfigured(message: string | null): boolean {
  return message?.includes('未配置') ?? false;
}

function toDetailRows(mode: Mode, details: Record<string, unknown>): DetailRow[] {
  if (mode === 'polish') {
    const changes = details.changes as
      | Array<{ original: string; revised: string; reason: string }>
      | undefined;
    if (!changes) return [];
    return changes.map((c, i) => ({
      label: `修改 ${i + 1}`,
      value: `${c.original} → ${c.revised}: ${c.reason}`,
    }));
  }
  if (mode === 'grammar') {
    const errors = details.errors as
      | Array<{ original: string; corrected: string; type: string; explanation: string }>
      | undefined;
    if (!errors) return [];
    return errors.map((e, i) => ({
      label: `错误 ${i + 1} (${e.type})`,
      value: `${e.original} → ${e.corrected}: ${e.explanation}`,
    }));
  }
  if (mode === 'upgrade') {
    const sentences = details.sentences as
      | Array<{ original: string; upgraded: string; technique: string }>
      | undefined;
    if (!sentences) return [];
    return sentences.map((s, i) => ({
      label: `句子 ${i + 1} (${s.technique})`,
      value: `${s.original} → ${s.upgraded}`,
    }));
  }
  const synonyms = details.synonyms as
    | Array<{ word: string; level: string; example: string }>
    | undefined;
  if (!synonyms) return [];
  return synonyms.map((s) => ({
    label: `${s.word} (${s.level})`,
    value: s.example,
  }));
}

export default function StudentAiAssistantPage() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('polish');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [details, setDetails] = useState<DetailRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<AiConversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    fetcher
      .getAiHistory({ limit: 10 })
      .then((res) => {
        if (res.success && res.data) {
          setHistory(res.data);
          console.log(`[StudentAiAssistant] 历史加载 count=${res.data.length}`);
        } else {
          setHistoryError(res.error ?? '获取历史记录失败');
          console.warn(`[StudentAiAssistant] 历史加载失败 error=${res.error ?? 'unknown'}`);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '获取历史记录失败';
        setHistoryError(msg);
        console.warn(`[StudentAiAssistant] 历史加载异常 error=${msg}`);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    console.log(`[StudentAiAssistant] mode切换 mode=${mode}`);
  }, [mode]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    console.log(`[StudentAiAssistant] 提交 mode=${mode} inputLength=${input.length}`);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setDetails([]);
    try {
      let res: AiResponse;
      if (mode === 'polish') {
        res = await fetcher.aiPolish(input);
      } else if (mode === 'upgrade') {
        res = await fetcher.aiUpgrade(input);
      } else if (mode === 'grammar') {
        res = await fetcher.aiGrammar(input);
      } else {
        const sepIndex = input.indexOf('|');
        let word: string;
        let context: string;
        if (sepIndex >= 0) {
          word = input.slice(0, sepIndex).trim();
          context = input.slice(sepIndex + 1).trim();
        } else {
          word = input.trim();
          context = '';
        }
        res = await fetcher.aiSynonym(word, context);
      }
      if (res.success && res.data) {
        setResult(res.data.output);
        setDetails(toDetailRows(mode, res.data.details));
        loadHistory();
        console.log(`[StudentAiAssistant] 提交成功 mode=${mode}`);
      } else {
        setError(res.error ?? 'AI 调用失败');
        console.warn(`[StudentAiAssistant] 提交失败 error=${res.error ?? 'unknown'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 调用失败';
      setError(msg);
      console.warn(`[StudentAiAssistant] 提交异常 error=${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setResult(null);
    setDetails([]);
    setError(null);
    setInput('');
  };

  const config = modeConfigs[mode];
  const displayedError = isAiNotConfigured(error) ? 'AI 服务未配置，请联系教师开通' : error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>AI 写作助手</Text>

        <View style={styles.modeBar}>
          {modeOrder.map((m) => (
            <Button
              key={m}
              title={modeLabels[m]}
              variant={mode === m ? 'primary' : 'secondary'}
              size="sm"
              onPress={() => handleSwitchMode(m)}
              colors={colors}
            />
          ))}
        </View>

        <Card colors={colors} style={styles.inputCard}>
          <Text style={[styles.inputTitle, { color: colors.textPrimary }]}>{config.title}</Text>
          <Text style={[styles.inputDesc, { color: colors.textSecondary }]}>
            {config.description}
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={config.placeholder}
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            style={[
              styles.textarea,
              {
                color: colors.textPrimary,
                backgroundColor: colors.bgElevated,
                borderColor: colors.border,
              },
            ]}
            spellCheck={false}
            autoCapitalize="none"
          />
          <Button
            title={isLoading ? '处理中...' : '提交'}
            onPress={handleSubmit}
            loading={isLoading}
            disabled={isLoading || !input.trim()}
            colors={colors}
          />
          {displayedError ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{displayedError}</Text>
          ) : null}
        </Card>

        {result !== null && (
          <Card colors={colors} style={styles.resultCard}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>AI 输出</Text>
            <Text style={[styles.resultText, { color: colors.textPrimary }]}>{result}</Text>
            {details.length > 0 && (
              <View style={styles.detailsBox}>
                {details.map((d, i) => (
                  <View key={`${d.label}-${i}`} style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      {d.label}
                    </Text>
                    <Text style={[styles.detailValue, { color: colors.textPrimary }]}>
                      {d.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        <Card colors={colors} style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>历史记录</Text>
          {historyLoading && <Loading colors={colors} />}
          {historyError ? (
            <Text style={[styles.historyError, { color: colors.error }]}>{historyError}</Text>
          ) : null}
          {!historyLoading && !historyError && history.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>暂无历史记录</Text>
          )}
          {history.map((item) => {
            const isOpen = expandedId === item.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.historyItem,
                  { borderBottomColor: colors.border, borderBottomWidth: 1 },
                ]}
              >
                <Button
                  title={''}
                  variant="ghost"
                  onPress={() => setExpandedId(isOpen ? null : item.id)}
                  colors={colors}
                  style={styles.historyButton}
                >
                  <View style={styles.historyItemHeader}>
                    <View style={styles.historyBadges}>
                      <Badge variant="secondary" colors={colors}>
                        {item.mode}
                      </Badge>
                      <Text style={[styles.historyDate, { color: colors.textTertiary }]}>
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <Text
                      style={[styles.historyInput, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {truncate(item.inputText, 40)}
                    </Text>
                  </View>
                </Button>
                {isOpen && (
                  <View style={styles.historyOutput}>
                    <Text style={[styles.outputLabel, { color: colors.textTertiary }]}>输出</Text>
                    <Text style={[styles.outputText, { color: colors.textPrimary }]}>
                      {item.outputText}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </Card>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  modeBar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  inputCard: {
    gap: 12,
  },
  inputTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  inputDesc: {
    fontSize: 13,
  },
  textarea: {
    minHeight: 140,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 1,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
  },
  resultCard: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultText: {
    fontSize: 15,
    lineHeight: 24,
  },
  detailsBox: {
    gap: 10,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 14,
    lineHeight: 20,
  },
  historyCard: {
    gap: 12,
  },
  historyError: {
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
  },
  historyItem: {
    paddingVertical: 10,
  },
  historyButton: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    height: 'auto',
    paddingHorizontal: 0,
  },
  historyItemHeader: {
    gap: 6,
    alignItems: 'flex-start',
  },
  historyBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyDate: {
    fontSize: 12,
  },
  historyInput: {
    fontSize: 14,
  },
  historyOutput: {
    marginTop: 8,
    gap: 4,
  },
  outputLabel: {
    fontSize: 12,
  },
  outputText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
