import { describe, expect, it } from 'vitest';
import { getScoreTier } from '../../constants/scoring.js';
import {
  calculateAbilityRadar,
  calculateClassRank,
  calculateErrorStats,
  calculateProgressCurve,
  calculateScoreDistribution,
  checkAchievements,
} from '../index.js';

describe('getScoreTier', () => {
  it('returns 1st tier for scores >= 13', () => {
    expect(getScoreTier(13).tier).toBe('1st');
    expect(getScoreTier(14).tier).toBe('1st');
    expect(getScoreTier(15).tier).toBe('1st');
  });

  it('returns 2nd tier for scores 10-12.99', () => {
    expect(getScoreTier(10).tier).toBe('2nd');
    expect(getScoreTier(12.5).tier).toBe('2nd');
    expect(getScoreTier(12.99).tier).toBe('2nd');
  });

  it('returns 3rd tier for scores 7-9.99', () => {
    expect(getScoreTier(7).tier).toBe('3rd');
    expect(getScoreTier(9.5).tier).toBe('3rd');
  });

  it('returns 4th tier for scores 4-6.99', () => {
    expect(getScoreTier(4).tier).toBe('4th');
    expect(getScoreTier(6.5).tier).toBe('4th');
  });

  it('returns 5th tier for scores 0-3.99', () => {
    expect(getScoreTier(0).tier).toBe('5th');
    expect(getScoreTier(3.5).tier).toBe('5th');
  });

  it('falls back to 5th tier for negative scores', () => {
    expect(getScoreTier(-1).tier).toBe('5th');
  });
});

describe('calculateScoreDistribution', () => {
  it('returns empty array for no scores', () => {
    expect(calculateScoreDistribution([])).toEqual([]);
  });

  it('distributes scores into correct ranges', () => {
    const scores = [14, 12, 10, 8, 5, 3];
    const result = calculateScoreDistribution(scores);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ range: '0-9', count: 3 });
    expect(result[1]).toEqual({ range: '10-11', count: 1 });
    expect(result[2]).toEqual({ range: '12-13', count: 1 });
    expect(result[3]).toEqual({ range: '14-15', count: 1 });
  });
});

describe('calculateErrorStats', () => {
  it('returns empty array for no errors', () => {
    expect(calculateErrorStats([])).toEqual([]);
  });

  it('counts and sorts by frequency descending', () => {
    const errors = [{ type: 'grammar' }, { type: 'grammar' }, { type: 'spelling' }];
    const result = calculateErrorStats(errors);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ type: 'grammar', count: 2, percentage: 67 });
    expect(result[1]).toEqual({ type: 'spelling', count: 1, percentage: 33 });
  });

  it('handles single error type', () => {
    const result = calculateErrorStats([{ type: 'punctuation' }]);
    expect(result).toEqual([{ type: 'punctuation', count: 1, percentage: 100 }]);
  });
});

describe('calculateAbilityRadar', () => {
  it('returns zero values for no essays', () => {
    const result = calculateAbilityRadar([]);
    expect(result).toHaveLength(5);
    expect(result.every((d) => d.value === 0)).toBe(true);
  });

  it('returns zero values when all scores are null', () => {
    const result = calculateAbilityRadar([
      {
        topicAdherenceScore: null,
        contentScore: null,
        languageScore: null,
        structureScore: null,
        presentationScore: null,
      },
    ]);
    expect(result.every((d) => d.value === 0)).toBe(true);
  });

  it('calculates average for each dimension', () => {
    const result = calculateAbilityRadar([
      {
        topicAdherenceScore: 1.5,
        contentScore: 4,
        languageScore: 3,
        structureScore: 2,
        presentationScore: 1,
      },
      {
        topicAdherenceScore: 2,
        contentScore: 5,
        languageScore: 4,
        structureScore: 2.5,
        presentationScore: 1,
      },
    ]);
    const topicAdherence = result.find((d) => d.label === 'TopicAdherence');
    const content = result.find((d) => d.label === 'Content');
    const language = result.find((d) => d.label === 'Language');
    expect(topicAdherence?.value).toBe(1.75);
    expect(topicAdherence?.max).toBe(2);
    expect(content?.value).toBe(4.5);
    expect(content?.max).toBe(5);
    expect(language?.value).toBe(3.5);
    expect(language?.max).toBe(4);
  });

  it('skips null scores in average calculation', () => {
    const result = calculateAbilityRadar([
      {
        topicAdherenceScore: 2,
        contentScore: 1,
        languageScore: null,
        structureScore: null,
        presentationScore: null,
      },
    ]);
    const topicAdherence = result.find((d) => d.label === 'TopicAdherence');
    const language = result.find((d) => d.label === 'Language');
    expect(topicAdherence?.value).toBe(2);
    expect(language?.value).toBe(0);
  });
});

describe('calculateProgressCurve', () => {
  it('returns empty array for no valid scores', () => {
    expect(calculateProgressCurve([{ totalScore: null, submittedAt: '2024-01-01' }])).toEqual([]);
  });

  it('sorts by submittedAt and formats date labels', () => {
    const result = calculateProgressCurve([
      { totalScore: 12, submittedAt: '2024-02-01T10:00:00Z' },
      { totalScore: 10, submittedAt: '2024-01-01T10:00:00Z' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(10);
    expect(result[1].value).toBe(12);
  });

  it('limits to last 20 entries', () => {
    const essays = Array.from({ length: 25 }, (_, i) => ({
      totalScore: 10 + i,
      submittedAt: `2024-01-${String(i + 1).padStart(2, '0')}`,
    }));
    const result = calculateProgressCurve(essays);
    expect(result).toHaveLength(20);
  });
});

describe('calculateClassRank', () => {
  it('returns zero rank for empty peers', () => {
    expect(calculateClassRank(10, [])).toEqual({ classRank: 0, total: 0, percentile: 0 });
  });

  it('calculates rank correctly', () => {
    const result = calculateClassRank(12, [10, 11, 13, 14]);
    expect(result.classRank).toBe(3);
    expect(result.total).toBe(4);
    expect(result.percentile).toBe(50);
  });

  it('ranks first when score is highest', () => {
    const result = calculateClassRank(15, [10, 11, 13, 14]);
    expect(result.classRank).toBe(1);
    expect(result.percentile).toBe(100);
  });

  it('ranks last when score is lowest', () => {
    const result = calculateClassRank(5, [10, 11, 13, 14]);
    expect(result.classRank).toBe(5);
    expect(result.percentile).toBe(0);
  });
});

describe('checkAchievements', () => {
  it('returns essay_10 for 10 essays', () => {
    const codes = checkAchievements({
      totalEssays: 10,
      averageScore: null,
      perfectScores: 0,
      consecutiveProgress: 0,
      errorFreeEssays: 0,
    });
    expect(codes).toContain('essay_10');
    expect(codes).not.toContain('essay_50');
  });

  it('returns essay_50 and essay_10 for 50 essays', () => {
    const codes = checkAchievements({
      totalEssays: 50,
      averageScore: null,
      perfectScores: 0,
      consecutiveProgress: 0,
      errorFreeEssays: 0,
    });
    expect(codes).toContain('essay_10');
    expect(codes).toContain('essay_50');
  });

  it('returns all achievements for high-performing student', () => {
    const codes = checkAchievements({
      totalEssays: 100,
      averageScore: 14,
      perfectScores: 3,
      consecutiveProgress: 5,
      errorFreeEssays: 10,
    });
    expect(codes).toContain('essay_10');
    expect(codes).toContain('essay_50');
    expect(codes).toContain('essay_100');
    expect(codes).toContain('perfect_score');
    expect(codes).toContain('progress_streak');
    expect(codes).toContain('first_tier_regular');
    expect(codes).toContain('grammar_master');
  });

  it('returns empty array for new student', () => {
    const codes = checkAchievements({
      totalEssays: 0,
      averageScore: null,
      perfectScores: 0,
      consecutiveProgress: 0,
      errorFreeEssays: 0,
    });
    expect(codes).toEqual([]);
  });
});
