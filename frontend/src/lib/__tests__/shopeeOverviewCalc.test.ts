import { describe, expect, it } from 'vitest';
import { buildOverviewCalcRows, calcOverviewMetrics, type OverviewMetrics } from '../shopeeOverview';
import type { SheetRow } from '../types';

// Regression test for the "Produk Dibeli" mapping bug: it must sum the
// "Produk (Pesanan Dibuat)" column, not the distinct "Produk Dipesan" column
// (cross-checked against a trusted reference report: 359 vs. the old, wrong
// 244 — see productoverview20260701-20260731.xlsx).
describe('calcOverviewMetrics — Produk Dibeli column mapping', () => {
  const rows: SheetRow[] = [
    { 'Total Pembeli (Pesanan Dibuat)': '10', 'Produk (Pesanan Dibuat)': '20', 'Produk Dipesan': '99' },
    { 'Total Pembeli (Pesanan Dibuat)': '5', 'Produk (Pesanan Dibuat)': '8', 'Produk Dipesan': '50' },
  ];

  it('maps "Produk Dibeli" to "Produk (Pesanan Dibuat)", not "Produk Dipesan"', () => {
    const m = calcOverviewMetrics(rows)!;
    expect(m.produkDibeli).toBe(28);
    expect(m.produkDibeli).not.toBe(149);
  });
});

describe('buildOverviewCalcRows — derived Conversion & Ratio Metrics', () => {
  function metrics(overrides: Partial<OverviewMetrics>): OverviewMetrics {
    return {
      pengunjung: 0,
      produkDilihat: 0,
      atc: 0,
      produkAtc: 0,
      purchase: 0,
      produkDibeli: 0,
      purchaseValue: 0,
      ...overrides,
    };
  }

  it('computes ATC to Order, Conversion Rate, AOV, AUR from the visitor-level ATC (not Produk ATC)', () => {
    const cur = metrics({ pengunjung: 20976, atc: 400, produkAtc: 900, purchase: 176, produkDibeli: 359, purchaseValue: 70723530 });
    const rows = buildOverviewCalcRows(cur, cur);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.atcToOrder.cur).toBe(((176 / 400) * 100).toFixed(2) + '%');
    expect(byKey.conversionRate.cur).toBe(((176 / 20976) * 100).toFixed(2) + '%');
    expect(byKey.aov.cur).toBe('Rp' + Math.round(70723530 / 176).toLocaleString('id-ID'));
    expect(byKey.aur.cur).toBe('Rp' + Math.round(70723530 / 359).toLocaleString('id-ID'));
  });

  it('matches the trusted reference report exactly (Jul 2026 sample: 359 units, Rp70.723.530, AUR Rp197.001)', () => {
    const cur = metrics({ purchase: 176, produkDibeli: 359, purchaseValue: 70723530 });
    const rows = buildOverviewCalcRows(cur, cur);
    const aur = rows.find((r) => r.key === 'aur')!;
    expect(aur.cur).toBe('Rp197.001');
  });

  it('shows "—" instead of Infinity/NaN when a denominator is 0', () => {
    const zero = metrics({});
    const rows = buildOverviewCalcRows(zero, zero);
    for (const r of rows) {
      expect(r.old).toBe('—');
      expect(r.cur).toBe('—');
    }
  });

  it('handles null old/cur metrics (no report data yet) without throwing', () => {
    const rows = buildOverviewCalcRows(null, null);
    for (const r of rows) {
      expect(r.old).toBe('—');
      expect(r.cur).toBe('—');
      expect(r.delta).toBe('—');
    }
  });
});
