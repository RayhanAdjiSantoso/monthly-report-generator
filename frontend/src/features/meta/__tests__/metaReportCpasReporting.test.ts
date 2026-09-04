import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { firstSheetRows } from '../../../lib/xlsxUtils';
import { buildMetaReport } from '../metaReport';
import type { SheetRow } from '../../../lib/types';

// ══════════════════════════════════════════════════════
// Regression: Meta Ads Reporting "Formatted data table" CPAS export
// (breakdown Campaign name > Age > Gender > Month), as used by the MIL
// template — which ships some custom-renamed columns:
//   • "Cost per adds to cart (shared items) (IDR)"   (not "… with shared")
//   • "Cost per puchase (shared items) (IDR)"        (sic — missing "r")
//
//  BUG #1  The CPAS cards showed the MAIN-account file's period labels
//          ("1-15 Jul") instead of CPAS's own full-month periods — the two
//          files are independent, CPAS is always a Month breakdown.
//  BUG #2  displayName() collapsed the three "adds to cart" columns
//          (count / cost-per / conversion-value) to one label "Add to Cart".
//  BUG #3  "Cost per puchase (shared items)" fell through to an
//          Impressions-weighted average of Meta's per-row cost values
//          instead of SUM(Amount Spent) ÷ SUM(Purchases with shared items).
// ══════════════════════════════════════════════════════

const JUL = '2026-07-01 - 2026-07-31';
const AUG = '2026-08-01 - 2026-08-31';

const HEADER = [
  'Campaign name', 'Age', 'Gender', 'Month', 'Amount spent (IDR)',
  'Result type', 'Results', 'Cost per result', 'Impressions',
  'Content views with shared items', 'Cost per content views (shared items) (IDR)',
  'Adds to cart with shared items', 'Cost per adds to cart (shared items) (IDR)',
  'Adds to cart conversion value for shared items only',
  'Purchases with shared items', 'Cost per puchase (shared items) (IDR)',
  'Purchases conversion value for shared items only', 'Purchase ROAS for shared items only',
];

interface Leaf {
  spent: number; impr: number; cv: number; atc: number; atcVal: number; purch: number; purchVal: number;
}

function row(camp: string, age: string, gender: string, month: string, v: Leaf): unknown[] {
  const results = v.atc; // this campaign optimizes for Adds to cart
  return [
    camp, age, gender, month, v.spent,
    'Adds to cart with shared items', results, v.spent / results, v.impr,
    v.cv, v.cv ? v.spent / v.cv : '',
    v.atc, v.atc ? v.spent / v.atc : '',
    v.atcVal,
    v.purch, v.purch ? v.spent / v.purch : '',
    v.purchVal, v.purchVal / v.spent,
  ];
}

// July leaves: spent 1,000,000 + 434,099 ; ATC 16 + 10 = 26 ; purch 2 + 1 = 3
const J1: Leaf = { spent: 1_000_000, impr: 150_000, cv: 700, atc: 16, atcVal: 4_000_000, purch: 2, purchVal: 1_800_000 };
const J2: Leaf = { spent: 434_099, impr: 66_218, cv: 303, atc: 10, atcVal: 2_561_000, purch: 1, purchVal: 1_017_000 };
// August leaves: spent 1,300,000 + 513,206 ; ATC 24 + 12 = 36 ; purch 7 + 3 = 10
const A1: Leaf = { spent: 1_300_000, impr: 180_000, cv: 800, atc: 24, atcVal: 5_000_000, purch: 7, purchVal: 2_800_000 };
const A2: Leaf = { spent: 513_206, impr: 79_444, cv: 379, atc: 12, atcVal: 3_099_200, purch: 3, purchVal: 1_224_200 };

function cpasRows(): SheetRow[] {
  const aoa: unknown[][] = [
    HEADER,
    row('NV | CPAS - Marketplace | Prospecting', '25-34', 'female', JUL, J1),
    row('RM | CPAS - Marketplace | Retargeting', '25-34', 'male', JUL, J2),
    row('NV | CPAS - Marketplace | Prospecting', '25-34', 'female', AUG, A1),
    row('RM | CPAS - Marketplace | Retargeting', '25-34', 'male', AUG, A2),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Raw Data Report');
  return firstSheetRows(wb);
}

function run() {
  const cRows = cpasRows();
  return buildMetaReport({
    // main account: a Day-breakdown file with a 1-15 sub-range selection
    metaRows: [
      { 'Campaign name': 'RM | Sales', Day: '2026-07-05', 'Amount spent (IDR)': 10 },
      { 'Campaign name': 'RM | Sales', Day: '2026-08-05', 'Amount spent (IDR)': 20 },
    ],
    metaHeaders: ['Campaign name', 'Day', 'Amount spent (IDR)'],
    cpasRows: cRows,
    cpasHeaders: Object.keys(cRows[0]),
    industry: 'retail',
    customResultsCol: null,
    dayRanges: {
      old: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 15) },
      cur: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 15) },
    },
  });
}

function d(rows: { col: string; label: string; old: string; cur: string }[], col: string) {
  return rows.find((r) => r.col === col);
}

describe('buildMetaReport — CPAS "Formatted data table" export', () => {
  it('BUG #1: CPAS uses its own full-month periods, not the main account 1-15 sub-range', () => {
    const r = run();
    expect(r.p1).toBe('1-15 Jul 2026'); // main account unchanged
    expect(r.cpas?.p1).toBe('Jul 2026');
    expect(r.cpas?.p2).toBe('Ags 2026');
  });

  it('BUG #2: the three "adds to cart" columns get distinct labels', () => {
    const rows = run().cpas?.overall?.detailedRows ?? [];
    expect(d(rows, 'Adds to cart with shared items')?.label).toBe('Adds to Cart (shared items)');
    expect(d(rows, 'Cost per adds to cart (shared items) (IDR)')?.label).toBe('Cost per Add to Cart (shared items)');
    expect(d(rows, 'Adds to cart conversion value for shared items only')?.label).toBe('Adds to Cart Conversion Value (shared items)');
  });

  it('BUG #3: "Cost per puchase (shared items)" = SUM(Amount Spent) ÷ SUM(Purchases with shared items)', () => {
    const rows = run().cpas?.overall?.detailedRows ?? [];
    // July: 1,434,099 / 3 = Rp478.033
    expect(d(rows, 'Cost per puchase (shared items) (IDR)')?.old).toBe('Rp478.033');
    // August: 1,813,206 / 10 = Rp181.321
    expect(d(rows, 'Cost per puchase (shared items) (IDR)')?.cur).toBe('Rp181.321');
    expect(d(rows, 'Purchases with shared items')?.old).toBe('3');
    expect(d(rows, 'Purchases with shared items')?.label).toBe('Purchases (shared items)');
  });

  it('"Results" / "Cost per result" are labelled as the blended metric', () => {
    const rows = run().cpas?.overall?.detailedRows ?? [];
    expect(d(rows, 'Results')?.label).toBe('Results (blended)');
    expect(d(rows, 'Cost per result')?.label).toBe('Cost per Result (blended)');
    expect(d(rows, 'Results')?.old).toBe('26'); // 16 + 10 leaf results for July
  });
});
