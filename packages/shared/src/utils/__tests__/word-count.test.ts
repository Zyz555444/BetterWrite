import { describe, expect, it } from 'vitest';
import { countWords, formatDuration, formatScore } from '../index.js';

describe('countWords', () => {
  it('counts English words split by whitespace', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('the quick brown fox')).toBe(4);
  });

  it('handles empty string', () => {
    expect(countWords('')).toBe(0);
  });

  it('handles whitespace-only string', () => {
    expect(countWords('   ')).toBe(0);
    expect(countWords('\t\n')).toBe(0);
  });

  it('counts punctuation-attached words as single words', () => {
    expect(countWords('hello, world!')).toBe(2);
    expect(countWords('it is a test.')).toBe(4);
  });

  it('handles mixed Chinese-English text', () => {
    expect(countWords('hello 你好')).toBe(2);
  });

  it('handles multiple spaces between words', () => {
    expect(countWords('hello    world')).toBe(2);
  });
});

describe('formatScore', () => {
  it('returns dash for null', () => {
    expect(formatScore(null)).toBe('-');
  });

  it('formats number to 1 decimal place', () => {
    expect(formatScore(12)).toBe('12.0');
    expect(formatScore(12.5)).toBe('12.5');
    expect(formatScore(14.25)).toBe('14.3');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds to MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(1000)).toBe('00:01');
    expect(formatDuration(65000)).toBe('01:05');
    expect(formatDuration(3600000)).toBe('60:00');
  });
});
