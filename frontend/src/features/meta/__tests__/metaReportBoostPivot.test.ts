import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { firstSheetRows } from '../../../lib/xlsxUtils';
import { buildMetaReport } from '../metaReport';
import type { SheetRow } from '../../../lib/types';

// ══════════════════════════════════════════════════════
// Regression: Meta's pivot-style "Report Otomatis – Boost Post" export.
//
// Structure = a breakdown hierarchy Month > Age > Gender > Campaign name,
// with a SUBTOTAL row at every not-fully-broken-out level (Campaign name
// "All", and blank in the repeated second "Campaign name" column). The file
// has NO Impressions and NO Clicks column — only per-row "CPC (cost per
// link click)" and "CTR (link click-through rate)" ratios.
//
// Two historical bugs this pins:
//  1. Subtotal rows weren't excluded → their "All" campaign name matched no
//     Boost-Post pattern → they landed in Non-Boost and added a full extra
//     copy of the account's spend (Non-Boost = leaf total + grand-total row).
//  2. CTR / CPC / "Cost Per IG Visit (IDR)" tried to aggregate the ratio
//     columns directly, hit blank cells, and rendered "—".
// ══════════════════════════════════════════════════════

const JUL = '2026-07-01 - 2026-07-31';
const AUG = '2026-08-01 - 2026-08-31';

const HEADER = [
  'Month',
  'Age',
  'Gender',
  'Campaign name',
  'Campaign name', // repeated — SheetJS dedupes the key to "Campaign name_1"
  'Amount spent (IDR)',
  'CTR (link click-through rate)',
  'CPC (cost per link click)',
  'Instagram profile visits',
  'Cost Per IG Visit (IDR)',
  'Checkouts initiated',
];

// leaf row: both campaign columns carry the specific name
function leaf(month: string, age: string, gender: string, name: string, vals: {
  spent: number; ctr: number; cpc: number; visits: number; costPerIg: number; co: number;
}): unknown[] {
  return [month, age, gender, name, name, vals.spent, vals.ctr, vals.cpc, vals.visits, vals.costPerIg, vals.co];
}

// subtotal row: Campaign name "All" in the first column, blank in the second
function subtotal(month: string, age: string, gender: string, vals: {
  spent: number; ctr: number; cpc: number; visits: number; costPerIg: number; co: number;
}): unknown[] {
  return [month, age, gender, 'All', '', vals.spent, vals.ctr, vals.cpc, vals.visits, vals.costPerIg, vals.co];
}

function buildFixtureRows(): SheetRow[] {
  const aoa: unknown[][] = [
    ['Report Otomatis – Boost Post', '', '', '', 'Report Period: Jul 1, 2026 - Aug 31, 2026'],
    [],
    HEADER,

    // ── July ──────────────────────────────────────────
    // grand total + an age subtotal — both must be ignored entirely
    subtotal(JUL, 'All', 'All', { spent: 400000, ctr: 1.25, cpc: 400, visits: 1024, costPerIg: 390.6, co: 999 }),
    subtotal(JUL, '25-34', 'All', { spent: 400000, ctr: 1.25, cpc: 400, visits: 1024, costPerIg: 390.6, co: 999 }),
    // Boost Post campaign — 2 breakdown rows, summed: clicks 300+200=500,
    // impressions 15000+10000=25000, spend 100000, visits 515
    leaf(JUL, '25-34', 'female', 'NV | Traffic - Profile Visit | Asia', { spent: 60000, ctr: 2.0, cpc: 200, visits: 309, costPerIg: 194.17, co: 4 }),
    leaf(JUL, '35-44', 'female', 'NV | Traffic - Profile Visit | Asia', { spent: 40000, ctr: 2.0, cpc: 200, visits: 206, costPerIg: 194.17, co: 2 }),
    // Non-Boost campaign — clicks 500, impressions 50000, spend 300000, visits 250
    leaf(JUL, '25-34', 'male', 'NV | Sales - Initiated CO | BoB Medium', { spent: 300000, ctr: 1.0, cpc: 600, visits: 250, costPerIg: 1200, co: 40 }),

    // ── August ────────────────────────────────────────
    subtotal(AUG, 'All', 'All', { spent: 250000, ctr: 1.4, cpc: 500, visits: 700, costPerIg: 357.1, co: 500 }),
    // Boost: clicks 250, impressions 12500, spend 50000, visits 200
    leaf(AUG, '25-34', 'female', 'NV | Traffic - Profile Visit | Asia', { spent: 50000, ctr: 2.0, cpc: 200, visits: 200, costPerIg: 250, co: 10 }),
    // Non-Boost: clicks 250, impressions 25000, spend 200000, visits 130
    leaf(AUG, '25-34', 'male', 'NV | Sales - Initiated CO | BoB Medium', { spent: 200000, ctr: 1.0, cpc: 800, visits: 130, costPerIg: 1538.46, co: 30 }),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Raw Data Report');
  return firstSheetRows(wb);
}

function run() {
  const rows = buildFixtureRows();
  return buildMetaReport({
    metaRows: rows,
    metaHeaders: Object.keys(rows[0]),
    cpasRows: null,
    cpasHeaders: [],
    industry: 'retail',
    customResultsCol: null,
    dayRanges: null,
  });
}

function detailed(section: { detailedRows: { col: string; old: string; cur: string }[] } | undefined, col: string) {
  return section?.detailedRows.find((r) => r.col === col);
}

describe('buildMetaReport — pivot "Boost Post" export (subtotal rows + ratio-only columns)', () => {
  it('BUG #1: excludes pivot subtotal rows so Non-Boost spend is not double-counted', () => {
    const report = run();
    // Non-Boost = the single non-boost leaf only, NOT + the grand-total /
    // age-subtotal rows (which would push July to 300k + 400k + 400k).
    expect(detailed(report.nonBoost, 'Amount spent (IDR)')?.old).toBe('Rp300.000');
    expect(detailed(report.nonBoost, 'Amount spent (IDR)')?.cur).toBe('Rp200.000');
    expect(detailed(report.boost, 'Amount spent (IDR)')?.old).toBe('Rp100.000');
    expect(detailed(report.boost, 'Amount spent (IDR)')?.cur).toBe('Rp50.000');
    // Boost + Non-Boost per period == the source grand-total row (400k / 250k).
    expect(detailed(report.nonBoost, 'Checkouts initiated')?.old).toBe('40'); // the leaf only, not 40 + 999 + 999
  });

  it('BUG #2: CTR / CPC / Cost Per IG Visit are recomputed from derived counts, never "—"', () => {
    const report = run();

    // Boost July: clicks 500 / impressions 25000 = 2.00% ; CPC 100000/500 =
    // Rp200 ; Cost per IG visit 100000/515 ≈ Rp194
    expect(detailed(report.boost, 'CTR (link click-through rate)')?.old).toBe('2,00%');
    expect(detailed(report.boost, 'CPC (cost per link click)')?.old).toBe('Rp200');
    expect(detailed(report.boost, 'Cost Per IG Visit (IDR)')?.old).toBe('Rp194');

    // Non-Boost July: clicks 500 / impressions 50000 = 1.00% ; CPC
    // 300000/500 = Rp600 ; Cost per IG visit 300000/250 = Rp1.200
    expect(detailed(report.nonBoost, 'CTR (link click-through rate)')?.old).toBe('1,00%');
    expect(detailed(report.nonBoost, 'CPC (cost per link click)')?.old).toBe('Rp600');
    expect(detailed(report.nonBoost, 'Cost Per IG Visit (IDR)')?.old).toBe('Rp1.200');

    // Non-Boost August: CPC 200000/250 = Rp800
    expect(detailed(report.nonBoost, 'CPC (cost per link click)')?.cur).toBe('Rp800');

    for (const col of ['CTR (link click-through rate)', 'CPC (cost per link click)', 'Cost Per IG Visit (IDR)']) {
      expect(detailed(report.boost, col)?.cur).not.toBe('—');
      expect(detailed(report.nonBoost, col)?.cur).not.toBe('—');
    }
  });
});
