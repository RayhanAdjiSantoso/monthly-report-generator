import { describe, expect, it } from 'vitest';
import { computeSummaryInsights, computeTotalAmountSpentItems, emptyPlatformStateMap, toSummaryKpi, type PlatformStateMap } from '../summary';

describe('toSummaryKpi', () => {
  it('reads Meta buildKPI rows shaped {val} as the current value', () => {
    const kpi = toSummaryKpi({ col: 'Amount Spent', old: 'Rp100', val: 'Rp150', delta: '+50.00%', deltaNum: 50, cls: 'delta-good' });
    expect(kpi).toMatchObject({ label: 'Amount Spent', old: 'Rp100', cur: 'Rp150' });
  });
  it('reads Shopee/TikTok rows shaped {cur} directly', () => {
    const kpi = toSummaryKpi({ key: 'biaya', label: 'Biaya', old: 'Rp100', cur: 'Rp150', delta: '+50.00%', deltaNum: 50, cls: 'delta-neutral' });
    expect(kpi).toMatchObject({ label: 'Biaya', old: 'Rp100', cur: 'Rp150' });
  });
});

function withMeta(state: PlatformStateMap): PlatformStateMap {
  return {
    ...state,
    meta: {
      done: true,
      error: null,
      data: {
        period: { old: 'Jun 2026', cur: 'Jul 2026' },
        kpis: [
          { label: 'Boost Post · Amount Spent', old: 'Rp100', cur: 'Rp250', delta: '+150.00%', deltaNum: 150, cls: 'delta-neutral' },
          { label: 'Non-Boost Post · Purchases', old: '10', cur: '5', delta: '-50.00%', deltaNum: -50, cls: 'delta-bad' },
        ],
        spend: { boost: { old: 100, cur: 250 }, nonboost: { old: 900, cur: 950 }, cpasOverall: { old: 500, cur: 500 } },
      },
    },
  };
}

describe('computeTotalAmountSpentItems', () => {
  it('includes Boost/Non-Boost spend but excludes CPAS Overall (to avoid double-counting NV+RM)', () => {
    const items = computeTotalAmountSpentItems(withMeta(emptyPlatformStateMap()));
    const labels = items.map((i) => i.label);
    expect(labels).toContain('Boost Post · Amount Spent (IDR)');
    expect(labels).toContain('Non-Boost Post · Amount Spent (IDR)');
    expect(labels).not.toContain('CPAS Marketplace · Overall · Amount Spent (IDR)');
  });

  it('returns an empty list when no platform has generated a report yet', () => {
    expect(computeTotalAmountSpentItems(emptyPlatformStateMap())).toEqual([]);
  });
});

describe('computeSummaryInsights', () => {
  it('ranks kpis by |delta| for topInsights and separates good/bad for best/worst', () => {
    const ins = computeSummaryInsights(withMeta(emptyPlatformStateMap()));
    expect(ins.worst).toMatchObject({ label: 'Non-Boost Post · Purchases', cls: 'delta-bad' });
    expect(ins.topInsights[0]).toMatchObject({ label: 'Boost Post · Amount Spent' }); // |150| > |50|
  });

  it('flags deltas >=15% as significant', () => {
    const ins = computeSummaryInsights(withMeta(emptyPlatformStateMap()));
    expect(ins.significant.length).toBe(2);
  });

  it('builds a prioritized recommendation for each opportunity (bad-delta) kpi', () => {
    const ins = computeSummaryInsights(withMeta(emptyPlatformStateMap()));
    expect(ins.recommendations).toHaveLength(1);
    expect(ins.recommendations[0].priority).toBe('Tinggi'); // |-50| >= 25
  });

  it('ignores platforms that have not generated a report', () => {
    const ins = computeSummaryInsights(emptyPlatformStateMap());
    expect(ins.all).toEqual([]);
    expect(ins.best).toBeNull();
    expect(ins.worst).toBeNull();
  });
});
