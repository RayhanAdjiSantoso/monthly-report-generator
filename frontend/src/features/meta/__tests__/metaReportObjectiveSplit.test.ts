import { describe, expect, it } from 'vitest';
import { buildMetaReport } from '../metaReport';
import { classifyMetaObjective, detectMetaObjectiveCol, dominantMetaObjective } from '../../../lib/meta';
import type { SheetRow } from '../../../lib/types';

// ══════════════════════════════════════════════════════
// PER-OBJECTIVE SPLIT — one ad account running Sales + Leads + Traffic at
// once. The Non-Boost lane must not collapse to one "Cost per Purchase"
// (that would divide Sales+Leads+Traffic spend by the purchase count).
// Driven by the "Objective" column (Meta ODAX / legacy enums).
// ══════════════════════════════════════════════════════

const HEADER = [
  'Campaign name',
  'Month',
  'Objective',
  'Amount spent (IDR)',
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
  objective: string;
  spent: number;
  results?: number;
  linkClicks?: number;
  purchases?: number;
  convValue?: number;
  roas?: number;
  leads?: number;
}

function row(month: string, l: Leaf): SheetRow {
  return {
    'Campaign name': l.camp,
    Month: month,
    Objective: l.objective,
    'Amount spent (IDR)': l.spent,
    Results: l.results ?? 0,
    Impressions: 0,
    'Link clicks': l.linkClicks ?? 0,
    Purchases: l.purchases ?? 0,
    'Purchases conversion value': l.convValue ?? 0,
    'Purchase ROAS': l.roas ?? 0,
    Leads: l.leads ?? 0,
  };
}

function build(rows: SheetRow[], headers = HEADER) {
  return buildMetaReport({ metaRows: rows, metaHeaders: headers, cpasRows: null, cpasHeaders: [], industry: null, customResultsCol: null, objective: null, dayRanges: null });
}

describe('classifyMetaObjective', () => {
  it('maps ODAX enums', () => {
    expect(classifyMetaObjective('OUTCOME_SALES')).toBe('sales');
    expect(classifyMetaObjective('OUTCOME_LEADS')).toBe('leads');
    expect(classifyMetaObjective('OUTCOME_TRAFFIC')).toBe('traffic');
    expect(classifyMetaObjective('OUTCOME_ENGAGEMENT')).toBe('engagement');
    expect(classifyMetaObjective('OUTCOME_AWARENESS')).toBe('awareness');
    expect(classifyMetaObjective('OUTCOME_APP_PROMOTION')).toBe('app');
  });
  it('maps pre-ODAX / legacy enums', () => {
    expect(classifyMetaObjective('CONVERSIONS')).toBe('sales');
    expect(classifyMetaObjective('PRODUCT_CATALOG_SALES')).toBe('sales');
    expect(classifyMetaObjective('LEAD_GENERATION')).toBe('leads');
    expect(classifyMetaObjective('LINK_CLICKS')).toBe('traffic');
    expect(classifyMetaObjective('POST_ENGAGEMENT')).toBe('engagement');
    expect(classifyMetaObjective('VIDEO_VIEWS')).toBe('engagement');
    expect(classifyMetaObjective('BRAND_AWARENESS')).toBe('awareness');
    expect(classifyMetaObjective('REACH')).toBe('awareness');
    expect(classifyMetaObjective('APP_INSTALLS')).toBe('app');
  });
  it('handles human labels + blanks', () => {
    expect(classifyMetaObjective('Sales')).toBe('sales');
    expect(classifyMetaObjective('Leads')).toBe('leads');
    expect(classifyMetaObjective('')).toBe('other');
    expect(classifyMetaObjective('WHATEVER_ELSE')).toBe('other');
  });
});

describe('detectMetaObjectiveCol', () => {
  it('matches "Objective" exactly, not "Result type"', () => {
    expect(detectMetaObjectiveCol(['Campaign name', 'Objective', 'Amount spent'])).toBe('Objective');
    expect(detectMetaObjectiveCol(['Campaign name', 'Result type', 'Results'])).toBeNull();
    expect(detectMetaObjectiveCol(['Campaign', 'Optimization goal'])).toBeNull();
  });
});

describe('dominantMetaObjective', () => {
  it('returns the highest-spend objective', () => {
    const rows = [
      { Objective: 'OUTCOME_SALES', spent: 100 },
      { Objective: 'OUTCOME_LEADS', spent: 40 },
      { Objective: 'OUTCOME_SALES', spent: 30 },
    ] as unknown as SheetRow[];
    expect(dominantMetaObjective(rows, 'Objective', 'spent')).toBe('sales');
  });
});

describe('buildMetaReport — Non-Boost split by the Objective column', () => {
  const rows = [
    // JUN
    row('2026-06', { camp: 'BRND | Prospecting', objective: 'OUTCOME_SALES', spent: 30_000_000, results: 300, purchases: 300, convValue: 90_000_000, roas: 3 }),
    row('2026-06', { camp: 'BRND | Form IG', objective: 'OUTCOME_LEADS', spent: 10_000_000, results: 200, leads: 200 }),
    row('2026-06', { camp: 'NV| Traffic | From Instagram', objective: 'LINK_CLICKS', spent: 5_000_000, results: 4000, linkClicks: 4000 }),
    // JUL
    row('2026-07', { camp: 'BRND | Prospecting', objective: 'OUTCOME_SALES', spent: 33_000_000, results: 250, purchases: 250, convValue: 100_000_000, roas: 3.03 }),
    row('2026-07', { camp: 'BRND | Form IG', objective: 'OUTCOME_LEADS', spent: 12_000_000, results: 260, leads: 260 }),
    row('2026-07', { camp: 'NV| Traffic | From Instagram', objective: 'LINK_CLICKS', spent: 6_000_000, results: 5200, linkClicks: 5200 }),
  ];
  const report = build(rows);

  it('one segment per objective, canonical order, human labels', () => {
    expect(report.nonBoostObjectiveSource).toBe('column');
    expect(report.nonBoostSegments!.map((s) => s.key)).toEqual(['sales', 'leads', 'traffic']);
    expect(report.nonBoostSegments!.map((s) => s.label)).toEqual(['Sales', 'Leads', 'Traffic']);
  });

  it('Cost per Purchase uses only Sales-campaign spend', () => {
    const sales = report.nonBoostSegments!.find((s) => s.key === 'sales')!;
    expect(sales.spendCur).toBe(33_000_000);
    const cpr = sales.overview.overviewRows.find((r) => r.label === 'Cost per Purchase');
    expect(cpr!.cur).toBe('Rp132.000'); // 33,000,000 / 250
  });

  it('each segment Amount Spent row is labelled with its objective', () => {
    const labels = report.nonBoostSegments!.map((s) => s.overview.overviewRows[0].label);
    expect(labels).toEqual(['Amount Spent (Sales)', 'Amount Spent (Leads)', 'Amount Spent (Traffic)']);
  });

  it('blended card carries an Amount Spent split per objective', () => {
    const labels = report.nonBoost!.overviewRows.map((r) => r.label);
    expect(labels).toContain('Amount Spent · Sales');
    expect(labels).toContain('Amount Spent · Leads');
    expect(labels).toContain('Amount Spent · Traffic');
    const salesSplit = report.nonBoost!.overviewRows.find((r) => r.label === 'Amount Spent · Sales')!;
    expect(salesSplit.cur).toBe('Rp33.000.000');
  });

  it('feeds per-objective KPIs into the Summary Overview', () => {
    const labels = report.summary.kpis.map((k) => k.label);
    expect(labels.some((l) => l.startsWith('Non-Boost · Sales · '))).toBe(true);
    expect(labels.some((l) => l === 'Non-Boost · Blended · Amount Spent · Leads')).toBe(true);
  });
});

describe('buildMetaReport — no Objective column', () => {
  it('uses the objective param as the single Non-Boost headline', () => {
    const H2 = HEADER.filter((h) => h !== 'Objective');
    const mk = (m: string, spent: number, purchases: number): SheetRow => ({
      'Campaign name': 'BRND | Sales',
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
    const report = buildMetaReport({ metaRows: [mk('2026-06', 20_000_000, 200), mk('2026-07', 22_000_000, 210)], metaHeaders: H2, cpasRows: null, cpasHeaders: [], industry: null, customResultsCol: null, objective: 'sales', dayRanges: null });
    expect(report.nonBoostSegments).toBeUndefined();
    const cpr = report.nonBoost!.overviewRows.find((r) => r.label === 'Cost per Purchase');
    expect(cpr!.cur).toBe('Rp104.762'); // 22,000,000 / 210
    expect(report.nonBoost!.overviewRows[0].label).toBe('Amount Spent (Sales)');
  });

  it('single objective in the column → single section, no dropdown needed', () => {
    const rows = [
      row('2026-06', { camp: 'BRND | A', objective: 'OUTCOME_SALES', spent: 20_000_000, purchases: 200, convValue: 60_000_000, roas: 3 }),
      row('2026-06', { camp: 'BRND | B', objective: 'OUTCOME_SALES', spent: 5_000_000, purchases: 40, convValue: 15_000_000, roas: 3 }),
      row('2026-07', { camp: 'BRND | A', objective: 'OUTCOME_SALES', spent: 22_000_000, purchases: 210, convValue: 66_000_000, roas: 3 }),
      row('2026-07', { camp: 'BRND | B', objective: 'OUTCOME_SALES', spent: 6_000_000, purchases: 50, convValue: 18_000_000, roas: 3 }),
    ];
    const report = build(rows);
    expect(report.nonBoostSegments).toBeUndefined();
    const cpr = report.nonBoost!.overviewRows.find((r) => r.label === 'Cost per Purchase');
    expect(cpr!.cur).toBe('Rp107.692'); // 28,000,000 / 260
  });
});
