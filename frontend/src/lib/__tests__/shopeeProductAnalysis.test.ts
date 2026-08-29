import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  buildPareto,
  buildProductRanking,
  buildProductRankings,
  CONVERSION_METRIC_DEFS,
  parseProductPerfRows,
  TRAFFIC_METRIC_DEFS,
} from '../shopeeProductAnalysis';
import type { SheetRow } from '../types';

const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);
function sheet(file: string): SheetRow[] {
  const buf = readFileSync(fileURLToPath(new URL(file, FIXTURES)));
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets['Produk dengan Performa Terbaik'], { defval: '' });
}

const curRows = sheet('product-performance.xlsx');
const oldRows = sheet('product-performance-jun.xlsx');
const cur = parseProductPerfRows(curRows);
const old = parseProductPerfRows(oldRows);

describe('parseProductPerfRows', () => {
  it('keeps only the product-level aggregate rows (Kode Variasi === "-")', () => {
    // Ground truth counted independently: 93 product-level rows (Jul), 97 (Jun).
    expect(cur).toHaveLength(93);
    expect(old).toHaveLength(97);
  });

  it('maps the Indonesian headers onto the metric set', () => {
    const top = cur.find((r) => r.produk.startsWith('Maiimi - Kids Series Bath Bomb Vol. I'))!;
    expect(top.clicks).toBe(42954);
    expect(top.impressions).toBe(810652);
  });

  it('derives Visit→ATC and ATC→Purchase rates from raw counts, with iferror→0 on a zero ATC base', () => {
    for (const r of cur) {
      expect(Number.isNaN(r.visitToAtcRate)).toBe(false);
      expect(Number.isNaN(r.atcToPurchaseRate)).toBe(false);
      if (r.clicks === 0) expect(r.visitToAtcRate).toBe(0);
    }
  });
});

describe('buildPareto', () => {
  const pareto = buildPareto(cur);

  it('ranks by Sales (Confirmed Order) descending', () => {
    for (let i = 1; i < pareto.length; i++) {
      expect(pareto[i].sales).toBeLessThanOrEqual(pareto[i - 1].sales);
    }
  });

  it('contribution sums to 100% and cumulative reaches 100% on the last row', () => {
    const sumContribution = pareto.reduce((s, r) => s + r.contribution, 0);
    expect(sumContribution).toBeCloseTo(100, 6);
    expect(pareto[pareto.length - 1].cumulative).toBeCloseTo(100, 6);
    for (let i = 1; i < pareto.length; i++) {
      expect(pareto[i].cumulative).toBeGreaterThanOrEqual(pareto[i - 1].cumulative);
    }
  });

  it('top product matches the independently-computed reference figure', () => {
    expect(pareto[0].produk).toBe('Maiimi - Bundle Wine & Wander Bubble Bath Travel Size 100ml + Bath Bomb');
    expect(pareto[0].sales).toBe(37715929);
    expect(pareto[0].contribution).toBeCloseTo((37715929 / 425173400) * 100, 4);
    expect(pareto[0].cumulative).toBeCloseTo(pareto[0].contribution, 6);
  });

  it('drops products with zero sales', () => {
    expect(pareto.every((r) => r.sales > 0)).toBe(true);
  });
});

describe('buildProductRanking — two periods', () => {
  const clicks = buildProductRanking(old, cur, 'clicks', 'higher-better');

  it('ranks by the current-period metric, descending', () => {
    expect(clicks[0].produk).toBe('Maiimi - Kids Series Bath Bomb Vol. I');
    expect(clicks[0].cur).toBe(42954);
    for (let i = 1; i < clicks.length; i++) {
      expect(clicks[i].cur ?? 0).toBeLessThanOrEqual(clicks[i - 1].cur ?? 0);
    }
  });

  it('carries the old value + a signed %Change for products present in both periods', () => {
    const both = clicks.find((r) => r.old !== null && r.old > 0 && r.cur !== null && r.cur > 0)!;
    expect(both.delta).toMatch(/^[+-]/);
    expect(both.deltaNum).not.toBeNull();
  });

  it('a product new this period has old = null and delta = "—"', () => {
    const fresh = clicks.find((r) => r.old === null);
    if (fresh) expect(fresh.delta).toBe('—');
  });
});

describe('buildProductRanking — single period (no old-period file)', () => {
  it('ranks by cur only, every old/%Change column null/"—"', () => {
    const rows = buildProductRanking([], cur, 'impressions', 'higher-better');
    expect(rows).toHaveLength(cur.length);
    expect(rows.every((r) => r.old === null && r.delta === '—' && r.deltaNum === null)).toBe(true);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].cur ?? 0).toBeLessThanOrEqual(rows[i - 1].cur ?? 0);
    }
  });
});

describe('buildProductRankings — metric groups', () => {
  it('builds one ranking per Traffic / Conversion metric def', () => {
    expect(buildProductRankings(old, cur, TRAFFIC_METRIC_DEFS).map((r) => r.metric)).toEqual(['clicks', 'impressions', 'ctr']);
    expect(buildProductRankings(old, cur, CONVERSION_METRIC_DEFS).map((r) => r.metric)).toEqual(['conversionRate', 'visitToAtcRate', 'atcToPurchaseRate']);
  });
});
