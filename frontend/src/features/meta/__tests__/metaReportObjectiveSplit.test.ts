import { describe, expect, it } from 'vitest';
import { buildMetaReport } from '../metaReport';
import { classifyMetaObjective, detectMetaObjectiveCol } from '../../../lib/meta';
import type { SheetRow } from '../../../lib/types';

// ══════════════════════════════════════════════════════
// PER-OBJECTIVE SPLIT — one ad account running Purchase + Leads + Traffic at
// once. The Non-Boost lane must not collapse to one "Cost per Purchase"
// (that would divide Purchase+Leads+Traffic spend by the purchase count).
// ══════════════════════════════════════════════════════

const HEADER = [
  'Campaign name',
  'Month',
  'Amount spent (IDR)',
  'Result type',
  'Results',
  'Impressions',
  'Link clicks',
  'Purchases',
  'Purchases conversion value',
  'Purchase ROAS',
  'Leads',
];

interface Leaf {
  camp: string;
  resultType: string;
  spent: number;
  results: number;
  impr: number;
  linkClicks: number;
  purchases: number;
  convValue: number;
  roas: number;
  leads: number;
}

function row(month: string, l: Leaf): SheetRow {
  return {
    'Campaign name': l.camp,
    Month: month,
    'Amount spent (IDR)': l.spent,
    'Result type': l.resultType,
    Results: l.results,
    Impressions: l.impr,
    'Link clicks': l.linkClicks,
    Purchases: l.purchases,
    'Purchases conversion value': l.convValue,
    'Purchase ROAS': l.roas,
    Leads: l.leads,
  };
}

const blank: Omit<Leaf, 'camp' | 'resultType' | 'spent'> = {
  results: 0,
  impr: 0,
  linkClicks: 0,
  purchases: 0,
  convValue: 0,
  roas: 0,
  leads: 0,
};

function build(rows: SheetRow[]) {
  return buildMetaReport({
    metaRows: rows,
    metaHeaders: HEADER,
    cpasRows: null,
    cpasHeaders: [],
    industry: null,
    customResultsCol: null,
    dayRanges: null,
  });
}

describe('classifyMetaObjective', () => {
  it('maps common Meta result-type / objective strings', () => {
    expect(classifyMetaObjective('Purchases')).toBe('purchase');
    expect(classifyMetaObjective('offsite_conversion.fb_pixel_purchase')).toBe('purchase');
    expect(classifyMetaObjective('Leads')).toBe('leads');
    expect(classifyMetaObjective('onsite_conversion.lead_grouped')).toBe('leads');
    expect(classifyMetaObjective('Messaging conversations started')).toBe('message');
    expect(classifyMetaObjective('Link clicks')).toBe('link_click');
    expect(classifyMetaObjective('Instagram profile visits')).toBe('profile_visit');
    expect(classifyMetaObjective('')).toBe('other');
    expect(classifyMetaObjective('Something weird')).toBe('other');
  });
});

describe('detectMetaObjectiveCol', () => {
  it('finds a Result type / Objective column, ignores unrelated headers', () => {
    expect(detectMetaObjectiveCol(['Campaign name', 'Result type', 'Results'])).toBe('Result type');
    expect(detectMetaObjectiveCol(['Campaign', 'Objective', 'Spent'])).toBe('Objective');
    expect(detectMetaObjectiveCol(['Campaign name', 'Amount spent', 'Purchases'])).toBeNull();
  });
});

describe('buildMetaReport — Non-Boost split by objective column', () => {
  const rows = [
    // JUN
    row('2026-06', { camp: 'BRAND - Purchase - Prospecting', resultType: 'Purchases', ...blank, spent: 30_000_000, results: 300, impr: 500_000, purchases: 300, convValue: 90_000_000, roas: 3 }),
    row('2026-06', { camp: 'BRAND - Leads - Form', resultType: 'Leads', ...blank, spent: 10_000_000, results: 200, impr: 200_000, leads: 200 }),
    row('2026-06', { camp: 'BRAND - Traffic - Retargeting', resultType: 'Link clicks', ...blank, spent: 5_000_000, results: 4000, impr: 300_000, linkClicks: 4000 }),
    // JUL
    row('2026-07', { camp: 'BRAND - Purchase - Prospecting', resultType: 'Purchases', ...blank, spent: 33_000_000, results: 250, impr: 520_000, purchases: 250, convValue: 100_000_000, roas: 3.03 }),
    row('2026-07', { camp: 'BRAND - Leads - Form', resultType: 'Leads', ...blank, spent: 12_000_000, results: 260, impr: 220_000, leads: 260 }),
    row('2026-07', { camp: 'BRAND - Traffic - Retargeting', resultType: 'Link clicks', ...blank, spent: 6_000_000, results: 5200, impr: 320_000, linkClicks: 5200 }),
  ];
  const report = build(rows);

  it('produces one segment per objective, in canonical order', () => {
    expect(report.nonBoostSegments).toBeDefined();
    expect(report.nonBoostObjectiveSource).toBe('column');
    expect(report.nonBoostSegments!.map((s) => s.key)).toEqual(['purchase', 'leads', 'link_click']);
    expect(report.nonBoostSegments!.map((s) => s.label)).toEqual(['Purchase', 'Leads', 'Traffic']);
  });

  it('each segment splits spend to its own campaigns only', () => {
    const [purchase, leads, traffic] = report.nonBoostSegments!;
    expect(purchase.spendCur).toBe(33_000_000);
    expect(leads.spendCur).toBe(12_000_000);
    expect(traffic.spendCur).toBe(6_000_000);
  });

  it('Cost per Purchase uses only purchase-campaign spend, not the whole lane', () => {
    const purchase = report.nonBoostSegments!.find((s) => s.key === 'purchase')!;
    const cpr = purchase.overview.overviewRows.find((r) => r.label === 'Cost per Purchase');
    expect(cpr).toBeDefined();
    // 33,000,000 / 250 = 132,000  (NOT 51,000,000 / 250)
    expect(cpr!.cur).toBe('Rp132.000');
  });

  it('Leads segment gets a Cost per Lead', () => {
    const leads = report.nonBoostSegments!.find((s) => s.key === 'leads')!;
    const cpr = leads.overview.overviewRows.find((r) => r.label === 'Cost per Lead');
    expect(cpr).toBeDefined();
    // 12,000,000 / 260 ≈ 46,154
    expect(cpr!.cur).toBe('Rp46.154');
  });

  it('keeps a blended headline on report.nonBoost (whole lane)', () => {
    expect(report.nonBoost).toBeDefined();
    const blended = report.nonBoost!.overviewRows.find((r) => r.label === 'Cost per Result (blended)');
    expect(blended).toBeDefined();
    // (33M + 12M + 6M) / (250 + 260 + 5200) = 51,000,000 / 5710 ≈ 8,932
    expect(blended!.cur).toBe('Rp8.932');
  });

  it('feeds per-objective KPIs into the Summary Overview', () => {
    const labels = report.summary.kpis.map((k) => k.label);
    expect(labels.some((l) => l.startsWith('Non-Boost · Purchase · '))).toBe(true);
    expect(labels.some((l) => l.startsWith('Non-Boost · Leads · '))).toBe(true);
    expect(labels.some((l) => l.startsWith('Non-Boost · Blended · '))).toBe(true);
  });
});

describe('buildMetaReport — single objective / no objective column', () => {
  it('falls back to the industry-driven single Non-Boost section (no objective column)', () => {
    const H2 = HEADER.filter((h) => h !== 'Result type');
    const mk = (m: string, spent: number, purchases: number) => ({
      'Campaign name': 'BRAND - Purchase A',
      Month: m,
      'Amount spent (IDR)': spent,
      Results: purchases,
      Impressions: 0,
      'Link clicks': 0,
      Purchases: purchases,
      'Purchases conversion value': purchases * 300_000,
      'Purchase ROAS': 3,
      Leads: 0,
    });
    const report = buildMetaReport({ metaRows: [mk('2026-06', 20_000_000, 200), mk('2026-07', 22_000_000, 210)], metaHeaders: H2, cpasRows: null, cpasHeaders: [], industry: 'retail', customResultsCol: null, dayRanges: null });
    expect(report.nonBoostSegments).toBeUndefined();
    const cpr = report.nonBoost!.overviewRows.find((r) => r.label === 'Cost per Purchase');
    expect(cpr!.cur).toBe('Rp104.762'); // 22,000,000 / 210
  });

  it('objective column present but only one objective → single section, no industry pick needed', () => {
    const rows = [
      row('2026-06', { camp: 'BRAND - Purchase A', resultType: 'Purchases', ...blank, spent: 20_000_000, results: 200, purchases: 200, convValue: 60_000_000, roas: 3 }),
      row('2026-06', { camp: 'BRAND - Purchase B', resultType: 'Purchases', ...blank, spent: 5_000_000, results: 40, purchases: 40, convValue: 15_000_000, roas: 3 }),
      row('2026-07', { camp: 'BRAND - Purchase A', resultType: 'Purchases', ...blank, spent: 22_000_000, results: 210, purchases: 210, convValue: 66_000_000, roas: 3 }),
      row('2026-07', { camp: 'BRAND - Purchase B', resultType: 'Purchases', ...blank, spent: 6_000_000, results: 50, purchases: 50, convValue: 18_000_000, roas: 3 }),
    ];
    const report = buildMetaReport({ metaRows: rows, metaHeaders: HEADER, cpasRows: null, cpasHeaders: [], industry: null, customResultsCol: null, dayRanges: null });
    expect(report.nonBoostSegments).toBeUndefined();
    expect(report.nonBoost).toBeDefined();
    const cpr = report.nonBoost!.overviewRows.find((r) => r.label === 'Cost per Purchase');
    // (22M + 6M) / (210 + 50) = 28,000,000 / 260 ≈ 107,692
    expect(cpr!.cur).toBe('Rp107.692');
  });
});
