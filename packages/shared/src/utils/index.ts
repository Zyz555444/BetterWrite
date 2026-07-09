import type { ScoreDistribution } from '../types/essay.js';

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function formatScore(score: number | null): string {
  if (score === null) return '-';
  return score.toFixed(1);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateScoreDistribution(scores: number[]): ScoreDistribution[] {
  if (scores.length === 0) return [];
  const ranges = [
    { range: '0-9', min: 0, max: 9.99 },
    { range: '10-11', min: 10, max: 11.99 },
    { range: '12-13', min: 12, max: 13.99 },
    { range: '14-15', min: 14, max: 15 },
  ];
  return ranges.map((r) => ({
    range: r.range,
    count: scores.filter((s) => s >= r.min && s <= r.max).length,
  }));
}

export function calculateErrorStats(
  errors: Array<{ type: string }>,
): Array<{ type: string; count: number; percentage: number }> {
  if (errors.length === 0) return [];
  const counts = new Map<string, number>();
  for (const e of errors) {
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
  }
  const total = errors.length;
  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

export function calculateAbilityRadar(
  essays: Array<{
    topicAdherenceScore: number | null;
    contentScore: number | null;
    languageScore: number | null;
    structureScore: number | null;
    presentationScore: number | null;
  }>,
): Array<{ label: string; value: number; max: number }> {
  const dims = [
    { label: 'TopicAdherence', key: 'topicAdherenceScore' as const, max: 3 },
    { label: 'Content', key: 'contentScore' as const, max: 1.5 },
    { label: 'Language', key: 'languageScore' as const, max: 6 },
    { label: 'Structure', key: 'structureScore' as const, max: 3 },
    { label: 'Presentation', key: 'presentationScore' as const, max: 1.5 },
  ];
  const valid = essays.filter(
    (e) =>
      e.topicAdherenceScore !== null ||
      e.contentScore !== null ||
      e.languageScore !== null ||
      e.structureScore !== null ||
      e.presentationScore !== null,
  );
  if (valid.length === 0) {
    return dims.map((d) => ({ label: d.label, value: 0, max: d.max }));
  }
  return dims.map((d) => {
    const scores = valid.map((e) => e[d.key]).filter((s): s is number => s !== null);
    if (scores.length === 0) return { label: d.label, value: 0, max: d.max };
    const sum = scores.reduce((acc, s) => acc + s, 0);
    return { label: d.label, value: sum / scores.length, max: d.max };
  });
}

export function calculateProgressCurve(
  essays: Array<{ totalScore: number | null; submittedAt: string }>,
): Array<{ label: string; value: number }> {
  const valid = essays
    .filter((e): e is { totalScore: number; submittedAt: string } => e.totalScore !== null)
    .slice()
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const recent = valid.slice(-20);
  return recent.map((e) => {
    const d = new Date(e.submittedAt);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return { label: `${month}-${day}`, value: e.totalScore };
  });
}

export function calculateClassRank(
  myAverage: number,
  peerScores: number[],
): { classRank: number; total: number; percentile: number } {
  const total = peerScores.length;
  if (total === 0) {
    return { classRank: 0, total: 0, percentile: 0 };
  }
  const higherCount = peerScores.filter((s) => s > myAverage).length;
  const classRank = higherCount + 1;
  const percentile = ((total - classRank + 1) / total) * 100;
  return { classRank, total, percentile };
}

export function checkAchievements(stats: {
  totalEssays: number;
  averageScore: number | null;
  perfectScores: number;
  consecutiveProgress: number;
  errorFreeEssays: number;
}): string[] {
  const codes: string[] = [];
  if (stats.totalEssays >= 10) codes.push('essay_10');
  if (stats.totalEssays >= 50) codes.push('essay_50');
  if (stats.totalEssays >= 100) codes.push('essay_100');
  if (stats.perfectScores >= 1) codes.push('perfect_score');
  if (stats.consecutiveProgress >= 3) codes.push('progress_streak');
  if (stats.averageScore !== null && stats.averageScore >= 13) {
    codes.push('first_tier_regular');
  }
  if (stats.errorFreeEssays >= 5) codes.push('grammar_master');
  return codes;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
