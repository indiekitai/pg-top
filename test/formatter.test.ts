import { describe, it, expect } from 'vitest';
import { formatDuration, formatSize, truncateQuery, formatPct, formatTps } from '../src/formatter.js';

describe('formatDuration', () => {
  it('handles null', () => expect(formatDuration(null)).toBe('-'));
  it('handles milliseconds', () => expect(formatDuration(0.5)).toBe('500ms'));
  it('handles seconds', () => expect(formatDuration(3.14)).toBe('3.1s'));
  it('handles minutes', () => expect(formatDuration(125)).toBe('2m05s'));
  it('handles hours', () => expect(formatDuration(7265)).toBe('2h01m'));
  it('handles zero', () => expect(formatDuration(0)).toBe('0ms'));
  it('handles negative', () => expect(formatDuration(-1)).toBe('-'));
});

describe('formatSize', () => {
  it('formats bytes', () => expect(formatSize(512)).toBe('512 B'));
  it('formats KB', () => expect(formatSize(1536)).toBe('1.5 KB'));
  it('formats MB', () => expect(formatSize(1048576)).toBe('1.0 MB'));
  it('formats GB', () => expect(formatSize(2147483648)).toBe('2.0 GB'));
});

describe('truncateQuery', () => {
  it('returns empty for null', () => expect(truncateQuery(null, 50)).toBe(''));
  it('collapses whitespace', () => expect(truncateQuery('SELECT\n  *\n  FROM  t', 50)).toBe('SELECT * FROM t'));
  it('truncates long queries', () => {
    const q = 'SELECT ' + 'x'.repeat(100);
    const result = truncateQuery(q, 20);
    expect(result.length).toBe(20);
    expect(result.endsWith('...')).toBe(true);
  });
  it('keeps short queries', () => expect(truncateQuery('SELECT 1', 50)).toBe('SELECT 1'));
});

describe('formatPct', () => {
  it('handles null', () => expect(formatPct(null)).toBe('-'));
  it('formats percentage', () => expect(formatPct(99.567)).toBe('99.6%'));
  it('supports custom decimals', () => expect(formatPct(99.567, 2)).toBe('99.57%'));
});

describe('formatTps', () => {
  it('handles null', () => expect(formatTps(null)).toBe('-'));
  it('formats small numbers', () => expect(formatTps(42)).toBe('42'));
  it('formats thousands', () => expect(formatTps(1500)).toBe('1.5k'));
});
