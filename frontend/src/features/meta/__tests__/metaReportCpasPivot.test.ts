import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { firstSheetRows } from '../../../lib/xlsxUtils';
import { buildMetaReport } from '../metaReport';
import type { SheetRow } from '../../../lib/types';

// ══════════════════════════════════════════════════════
// Regression: Meta's pivot "Report Otomatis – CPAS" export
// (Month > Age > Gender > Campaign name, with "All" subtotal rows).
//
//  BUG #1  "Overall" tab double-counted every absolute metric because the
//          pivot subtotal rows (Campaign name "All") were aggregated
//          alongside the leaf campaign rows. NV/RM escaped it only because
//          groupByCamp's "NV"/"RM" regex never matches "All".
//  BUG #2  "ATC (%)" / "Purchase (%)" summed the raw per-row ratio cells
//          instead of ATC ÷ LinkClicks and Purchases ÷ ATC from summed
//          base counts (LinkClicks = Spend ÷ CPC).
//  BUG #3  "Cost Per Purchase" divided Spend by the summed "Purchase (%)"
//          column (findDenomCol picked it up as a "purchase" count) instead
//          of by the "Purchases with shared items" count.
// ══════════════════════════════════════════════════════

const JUL = '2026-07-01 - 2026-07-31';
const AUG = '2026-08-01 - 2026-08-31';

const HEADER = [
  'Month', 'Age', 'Gender', 'Campaign name', 'Campaign name',
  'Amount spent (IDR)', 'CTR (link click-through rate)', 'CPC (cost per link click)',
  'Instagram profile visits', 'Cost Per IG Visit (IDR)', 'Content views', 'Cost per content view',
  'ATC (%)', 'Purchase (%)',
  'Adds to cart with shared items', 'Adds to cart conversion value for shared items only',
  'Content views with shared items', 'Purchase ROAS for shared items only',
  'Purchases with shared items', 'Purchases conversion value for shared items only',
  'Cost per add to cart', 'Cost Per Purchase',
];

interface Leaf {
  spent: number; cpc: number; ctr: number; igv: number; cv: number;
  atc: number; atcVal: number; cvShared: number; purch: number; purchVal: number;
}

function row(month: string, age: string, gender: string, name: string, v: Leaf): unknown[] {
  const clicks = v.spent / v.cpc;
  return [
    month, age, gender, name, name,
    v.spent, v.ctr, v.cpc, v.igv, v.spent / v.igv, v.cv, v.cv ? v.spent / v.cv : '',
    v.atc / clicks, v.atc ? v.purch / v.atc : 0, // raw per-row ATC%/Purchase% fractions — must be ignored
    v.atc, v.atcVal, v.cvShared, v.purchVal / v.spent,
    v.purch, v.purchVal, v.atc ? v.spent / v.atc : '', v.purch ? v.spent / v.purch : '',
  ];
}

function subtotal(month: string, age: string): unknown[] {
  // a full grand-total-ish row; every absolute field carries the whole
  // period's total so a leak would ~double the Overall numbers
  return [month, age, 'All', 'All', '', 3_000_000, 1.1, 600, 1500, 2000, 50, 60000, 0.21, 0.21, 1050, 1_500_000_000, 13000, 8, 225, 24_000_000, 2857, 13333];
}

const NV_JUL: Leaf = { spent: 1_000_000, cpc: 1000, ctr: 2.0, igv: 500, cv: 10, atc: 250, atcVal: 500_000_000, cvShared: 5000, purch: 25, purchVal: 4_000_000 };
const RM_JUL: Leaf = { spent: 2_000_000, cpc: 500, ctr: 1.0, igv: 1000, cv: 40, atc: 800, atcVal: 1_000_000_000, cvShared: 8000, purch: 200, purchVal: 20_000_000 };
const NV_AUG: Leaf = { spent: 1_500_000, cpc: 1000, ctr: 2.0, igv: 600, cv: 12, atc: 375, atcVal: 600_000_000, cvShared: 6000, purch: 30, purchVal: 6_000_000 };
const RM_AUG: Leaf = { spent: 1_000_000, cpc: 500, ctr: 1.0, igv: 500, cv: 20, atc: 400, atcVal: 500_000_000, cvShared: 4000, purch: 100, purchVal: 12_000_000 };

function cpasRows(): SheetRow[] {
  const aoa: unknown[][] = [
    ['Report Otomatis – CPAS', '', '', '', 'Report Period: Jul 1 – Aug 31, 2026'],
    [],
    HEADER,
    subtotal(JUL, 'All'),
    subtotal(JUL, '25-34'),
    row(JUL, '25-34', 'female', 'NV | CPAS - Marketplace | Prospecting', NV_JUL),
    row(JUL, '25-34', 'male', 'RM | CPAS - Marketplace | Retargeting', RM_JUL),
    subtotal(AUG, 'All'),
    row(AUG, '25-34', 'female', 'NV | CPAS - Marketplace | Prospecting', NV_AUG),
    row(AUG, '25-34', 'male', 'RM | CPAS - Marketplace | Retargeting', RM_AUG),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Raw Data Report');
  return firstSheetRows(wb);
}

// minimal main-file rows so buildMetaReport has a valid Meta section too
function metaRows(): SheetRow[] {
  return [
    { 'Campaign name': 'RM | Sales', Month: JUL, 'Amount Spent (IDR)': 10 },
    { 'Campaign name': 'RM | Sales', Month: AUG, 'Amount Spent (IDR)': 20 },
  ];
}

function run() {
  const cRows = cpasRows();
  return buildMetaReport({
    metaRows: metaRows(),
    metaHeaders: ['Campaign name', 'Month', 'Amount Spent (IDR)'],
    cpasRows: cRows,
    cpasHeaders: Object.keys(cRows[0]),
    industry: 'retail',
    customResultsCol: null,
    dayRanges: null,
  });
}

function d(section: { detailedRows: { col: string; old: string; cur: string }[] } | undefined, col: string) {
  return section?.detailedRows.find((r) => r.col === col);
}

describe('buildMetaReport — CPAS pivot export', () => {
  it('BUG #1: "Overall" excludes subtotal rows — absolute metrics are leaf totals only', () => {
    const o = run().cpas?.overall;
    // July leaves: 1,000,000 + 2,000,000 = 3,000,000 (NOT + two 3,000,000 subtotals)
    expect(d(o, 'Amount spent (IDR)')?.old).toBe('Rp3.000.000');
    expect(d(o, 'Amount spent (IDR)')?.cur).toBe('Rp2.500.000');
    expect(d(o, 'Purchases with shared items')?.old).toBe('225'); // 25 + 200
    expect(d(o, 'Purchases with shared items')?.cur).toBe('130'); // 30 + 100
    expect(d(o, 'Adds to cart with shared items')?.old).toBe('1.050');
    expect(d(o, 'Adds to cart conversion value for shared items only')?.old).toBe('Rp1.500.000.000');
    expect(d(o, 'Content views with shared items')?.old).toBe('13.000');
    expect(d(o, 'Instagram profile visits')?.old).toBe('1.500');
  });

  it('BUG #1: ratio fields stay correct after the double-count is removed', () => {
    const o = run().cpas?.overall;
    // ROAS July = 24,000,000 / 3,000,000 = 8.00x
    expect(d(o, 'Purchase ROAS for shared items only')?.old).toBe('8,00x');
    // CPC July = 3,000,000 / (1,000,000/1000 + 2,000,000/500) = 3,000,000 / 5000 = Rp600
    expect(d(o, 'CPC (cost per link click)')?.old).toBe('Rp600');
    // CTR July = 5000 clicks / 450000 impressions × 100 = 1.11%
    expect(d(o, 'CTR (link click-through rate)')?.old).toBe('1,11%');
    // Cost per IG visit July = 3,000,000 / 1500 = Rp2.000
    expect(d(o, 'Cost Per IG Visit (IDR)')?.old).toBe('Rp2.000');
    // Cost per add to cart July = 3,000,000 / 1050 = Rp2.857
    expect(d(o, 'Cost per add to cart')?.old).toBe('Rp2.857');
  });

  it('BUG #2: ATC (%) = Add to Cart ÷ Link Clicks × 100, from summed counts', () => {
    const r = run().cpas;
    // Overall July: ATC 1050 / clicks 5000 × 100 = 21  (fmt drops ",00")
    expect(d(r?.overall, 'ATC (%)')?.old).toBe('21');
    // NV July: 250 / 1000 = 25 ; RM July: 800 / 4000 = 20
    expect(d(r?.nv, 'ATC (%)')?.old).toBe('25');
    expect(d(r?.rm, 'ATC (%)')?.old).toBe('20');
    // Overall Aug: 775 / 3500 × 100 = 22.14
    expect(d(r?.overall, 'ATC (%)')?.cur).toBe('22,14');
  });

  it('BUG #2: Purchase (%) = Purchases ÷ Add to Cart × 100, from summed counts', () => {
    const r = run().cpas;
    // Overall July: 225 / 1050 × 100 = 21.43
    expect(d(r?.overall, 'Purchase (%)')?.old).toBe('21,43');
    // NV July: 25 / 250 = 10 ; RM July: 200 / 800 = 25
    expect(d(r?.nv, 'Purchase (%)')?.old).toBe('10');
    expect(d(r?.rm, 'Purchase (%)')?.old).toBe('25');
  });

  it('BUG #3: Cost Per Purchase = Amount Spent ÷ Purchases count (never ÷ Purchase %)', () => {
    const r = run().cpas;
    // Overall July: 3,000,000 / 225 = Rp13.333  (NOT 3,000,000 / 0.2143 ≈ Rp14,000,000)
    expect(d(r?.overall, 'Cost Per Purchase')?.old).toBe('Rp13.333');
    // NV July: 1,000,000 / 25 = Rp40.000 ; RM July: 2,000,000 / 200 = Rp10.000
    expect(d(r?.nv, 'Cost Per Purchase')?.old).toBe('Rp40.000');
    expect(d(r?.rm, 'Cost Per Purchase')?.old).toBe('Rp10.000');
    // Overall Aug: 2,500,000 / 130 = Rp19.231
    expect(d(r?.overall, 'Cost Per Purchase')?.cur).toBe('Rp19.231');
  });
});
