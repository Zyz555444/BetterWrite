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
