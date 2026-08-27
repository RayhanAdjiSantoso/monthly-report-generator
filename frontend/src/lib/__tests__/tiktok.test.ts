import { describe, expect, it } from 'vitest';
import { buildTiktokKPIRows, calcTiktokMetrics, periodFromTiktokFilename, tiktokNum } from '../tiktok';
import type { SheetRow } from '../types';

// No TikTok sample export is provided under data/shopee-data-fin (Shopee-only),
// so these exercise the parsing/aggregation logic against handcrafted rows
// shaped like a TikTok Ads Manager campaign export.

describe('tiktokNum', () => {
  it('tries each candidate key in order and strips thousands commas', () => {
    const row: SheetRow = { 'SKU Orders': '1,234' };
    expect(tiktokNum(row, 'SKU orders', 'SKU Orders')).toBe(1234);
  });
  it('falls back to 0 when no candidate key is present', () => {
    expect(tiktokNum({}, 'Cost', 'cost')).toBe(0);
  });
});

describe('periodFromTiktokFilename', () => {
  it('reads a "start_-_end" range with underscores, keeping the real day range (Fase 1)', () => {
    const p = periodFromTiktokFilename('Campaign_report_2026-06-15_-_2026-06-21.xlsx');
    expect(p.label).toBe('15-21 Jun 2026');
    expect(p.days).toBe(7);
  });
  it('reads a "start - end" range with spaces, spanning months', () => {
    expect(periodFromTiktokFilename('Campaign report 2026-06-25 - 2026-07-05.xlsx').label).toBe('25 Jun-5 Jul 2026');
  });
  it('falls back to any two ISO dates found anywhere in the name, collapsing a full month as before', () => {
    const p = periodFromTiktokFilename('export-2026-07-01-to-2026-07-31-final.xlsx');
    expect(p.label).toBe('Jul 2026');
    expect(p.days).toBe(31);
  });
  it('falls back to a single date when only one is present (no dash)', () => {
    expect(periodFromTiktokFilename('export-2026-07-01.xlsx').label).toBe('1 Jul 2026');
  });
  it('returns an empty period when no date is found', () => {
    const p = periodFromTiktokFilename('export.xlsx');
    expect(p.label).toBe('');
    expect(p.days).toBeNull();
  });
});

describe('calcTiktokMetrics', () => {
  const rows: SheetRow[] = [
    { Cost: '1,000,000', 'SKU orders': '10', 'Gross revenue': '5,000,000' },
    { Cost: '500,000', 'SKU orders': '5', 'Gross revenue': '2,000,000' },
  ];

  it('sums cost/orders/revenue and derives cpo/aov/roi', () => {
    const m = calcTiktokMetrics(rows);
    expect(m.cost).toBe(1_500_000);
    expect(m.orders).toBe(15);
    expect(m.revenue).toBe(7_000_000);
    expect(m.cpo).toBeCloseTo(1_500_000 / 15);
    expect(m.aov).toBeCloseTo(7_000_000 / 15);
    expect(m.roi).toBeCloseTo(7_000_000 / 1_500_000);
  });

  it('defaults derived ratios to 0 with no rows', () => {
    const m = calcTiktokMetrics([]);
    expect(m).toEqual({ cost: 0, orders: 0, cpo: 0, revenue: 0, aov: 0, roi: 0 });
  });
});

describe('buildTiktokKPIRows', () => {
  it('formats each metric and computes its delta', () => {
    const mOld = calcTiktokMetrics([{ Cost: '1000000', 'SKU orders': '10', 'Gross revenue': '3000000' }]);
    const mCur = calcTiktokMetrics([{ Cost: '1000000', 'SKU orders': '20', 'Gross revenue': '6000000' }]);
    const rows = buildTiktokKPIRows(mOld, mCur);
    const orderRow = rows.find((r) => r.key === 'orders')!;
    expect(orderRow).toMatchObject({ old: '10', cur: '20', delta: '+100.00%', cls: 'delta-good' });
    const costRow = rows.find((r) => r.key === 'cost')!;
    // Cost is sentiment "neutral" — deltas never color it good/bad.
    expect(costRow.cls).toBe('delta-neutral');
  });
});
