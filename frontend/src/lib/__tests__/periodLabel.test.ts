import { describe, expect, it } from 'vitest';
import { buildParsedPeriod, comparePeriodDays, daysBetweenInclusive, formatPeriodLabel, parseDateRangeDMY } from '../periodLabel';

describe('formatPeriodLabel', () => {
  it('collapses a full calendar month to "Mon YYYY"', () => {
    expect(formatPeriodLabel(new Date(2026, 6, 1), new Date(2026, 6, 31))).toBe('Jul 2026');
  });

  it('keeps a partial same-month range as "D1-D2 Mon YYYY"', () => {
    expect(formatPeriodLabel(new Date(2026, 6, 1), new Date(2026, 6, 18))).toBe('1-18 Jul 2026');
  });

  it('spans two months in the same year as "D1 Mon1-D2 Mon2 YYYY"', () => {
    expect(formatPeriodLabel(new Date(2026, 5, 25), new Date(2026, 6, 5))).toBe('25 Jun-5 Jul 2026');
  });

  it('spans a year boundary with both years shown', () => {
    expect(formatPeriodLabel(new Date(2025, 11, 28), new Date(2026, 0, 3))).toBe('28 Des 2025-3 Jan 2026');
  });

  it('a single-day period reads as "D Mon YYYY" with no dash, not "D-D Mon YYYY"', () => {
    expect(formatPeriodLabel(new Date(2026, 6, 18), new Date(2026, 6, 18))).toBe('18 Jul 2026');
  });

  it('a full-month check requires day 1 through the actual last day (28-31 depending on month)', () => {
    // Feb 2026 has 28 days — day 1-28 is a full month, day 1-27 is not.
    expect(formatPeriodLabel(new Date(2026, 1, 1), new Date(2026, 1, 28))).toBe('Feb 2026');
    expect(formatPeriodLabel(new Date(2026, 1, 1), new Date(2026, 1, 27))).toBe('1-27 Feb 2026');
  });
});

describe('daysBetweenInclusive', () => {
  it('counts both endpoints (a full 31-day month spans 31 days, not 30)', () => {
    expect(daysBetweenInclusive(new Date(2026, 6, 1), new Date(2026, 6, 31))).toBe(31);
  });
  it('a single day is 1 day, not 0', () => {
    expect(daysBetweenInclusive(new Date(2026, 6, 1), new Date(2026, 6, 1))).toBe(1);
  });
});

describe('parseDateRangeDMY', () => {
  it('parses Shopee\'s "DD/MM/YYYY - DD/MM/YYYY" metadata format', () => {
    const r = parseDateRangeDMY('01/07/2026 - 31/07/2026');
    expect(r).not.toBeNull();
    expect(r!.start).toEqual(new Date(2026, 6, 1));
    expect(r!.end).toEqual(new Date(2026, 6, 31));
  });
  it('returns null when the string does not contain a recognizable range', () => {
    expect(parseDateRangeDMY('not a date')).toBeNull();
  });
});

describe('buildParsedPeriod', () => {
  it('combines label + days from a start/end pair', () => {
    const p = buildParsedPeriod(new Date(2026, 6, 1), new Date(2026, 6, 18));
    expect(p).toEqual({ label: '1-18 Jul 2026', start: new Date(2026, 6, 1), end: new Date(2026, 6, 18), days: 18 });
  });
});

describe('comparePeriodDays', () => {
  it('flags a mismatch beyond tolerance, in the example shape from the spec', () => {
    expect(comparePeriodDays(31, 18)).toBe('Periode tidak sama panjang: 31 hari vs 18 hari — bandingkan dengan hati-hati.');
  });
  it('stays silent within tolerance (default 1 day)', () => {
    expect(comparePeriodDays(30, 31)).toBeNull();
    expect(comparePeriodDays(31, 31)).toBeNull();
  });
  it('stays silent when either side is unknown', () => {
    expect(comparePeriodDays(null, 31)).toBeNull();
    expect(comparePeriodDays(31, null)).toBeNull();
  });
});
