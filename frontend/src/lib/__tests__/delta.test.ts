import { describe, expect, it } from 'vitest';
import { computeDelta, deltaClassForSentiment, formatDeltaID } from '../delta';

describe('computeDelta', () => {
  it('returns — when either value is missing', () => {
    expect(computeDelta(null, 10)).toEqual({ deltaNum: null, deltaStr: '—' });
    expect(computeDelta(10, undefined)).toEqual({ deltaNum: null, deltaStr: '—' });
  });

  it('treats 0 -> 0 as flat 0%', () => {
    expect(computeDelta(0, 0)).toEqual({ deltaNum: 0, deltaStr: '0%' });
  });

  it('treats 0 -> positive as "New" (no baseline)', () => {
    const r = computeDelta(0, 500);
    expect(r.deltaNum).toBeNull();
    expect(r.deltaStr).toBe('New');
  });

  it('treats 0 -> negative as N/A (defensive, unreachable in practice)', () => {
    const r = computeDelta(0, -5);
    expect(r.deltaNum).toBeNull();
    expect(r.deltaStr).toBe('N/A');
  });

  it('computes signed percentage change relative to |old|', () => {
    expect(computeDelta(100, 150)).toEqual({ deltaNum: 50, deltaStr: '+50.00%' });
    expect(computeDelta(100, 50)).toEqual({ deltaNum: -50, deltaStr: '-50.00%' });
    // Negative baseline: percentage is still relative to the magnitude of old.
    expect(computeDelta(-100, -50).deltaNum).toBe(50);
  });
});

describe('formatDeltaID — Shopee Deep-Dive\'s Indonesian comma-decimal delta format', () => {
  it('uses a comma decimal separator instead of computeDelta\'s own dot (e.g. "+50,00%" not "+50.00%")', () => {
    const { deltaNum } = computeDelta(100, 150);
    expect(formatDeltaID(deltaNum, '—')).toBe('+50,00%');
  });

  it('keeps the sign for a negative change', () => {
    const { deltaNum } = computeDelta(100, 50);
    expect(formatDeltaID(deltaNum, '—')).toBe('-50,00%');
  });

  it('falls back to the given fallback string when deltaNum is null (New/N.A/—)', () => {
    expect(formatDeltaID(null, 'New')).toBe('New');
    expect(formatDeltaID(null, '—')).toBe('—');
  });

  it('uses a dot for the thousands separator when the magnitude is large', () => {
    const { deltaNum } = computeDelta(100, 1350);
    expect(formatDeltaID(deltaNum, '—')).toBe('+1.250,00%');
  });
});

describe('deltaClassForSentiment', () => {
  it('is neutral when deltaNum is null or sentiment is neutral', () => {
    expect(deltaClassForSentiment(null, 'higher-better')).toBe('delta-neutral');
    expect(deltaClassForSentiment(10, 'neutral')).toBe('delta-neutral');
  });

  it('higher-better: up is good, down is bad', () => {
    expect(deltaClassForSentiment(10, 'higher-better')).toBe('delta-good');
    expect(deltaClassForSentiment(-10, 'higher-better')).toBe('delta-bad');
  });

  it('lower-better: up is bad, down is good', () => {
    expect(deltaClassForSentiment(10, 'lower-better')).toBe('delta-bad');
    expect(deltaClassForSentiment(-10, 'lower-better')).toBe('delta-good');
  });
});
