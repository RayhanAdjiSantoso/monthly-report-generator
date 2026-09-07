import { describe, expect, it } from 'vitest';
import type { SheetRow } from '../../../lib/types';
import { buildMetaReport } from '../metaReport';

// Regression: Meta's export names this column "Cost per Instagram Follows
// (IDR)". It matched no rule in COST_PER_MAP — not 'cost per follow', and not
// 'cost per instagram profile' either — so it fell through to agg()'s
// last-resort weighted average of Meta's own per-row cost values. On a real
// August export that produced Rp1.582 where Spend ÷ Follows is Rp3.213, while
// every other cost-per in the same table was correct because each of those
// did hit a rule.
//
// The numbers below are that export's Boost Post figures, reduced to two rows
// per period so the arithmetic is checkable by hand:
//   Jul  Rp3.213.557 / 1.219 follows = Rp2.636
//   Ags  Rp4.157.914 / 1.294 follows = Rp3.213
const CAMPAIGN = 'RM | Traffic - Profile Visit | Boost Post';

function row(month: string, spent: number, follows: number, costPerFollow: number): SheetRow {
  return {
    'Campaign name': CAMPAIGN,
    Age: '25-34',
    Gender: 'female',
    Month: month,
    Impressions: 100000,
    'Amount spent (IDR)': spent,
    'Instagram follows': follows,
    // Deliberately inconsistent with spent/follows: this is the per-row value
    // Meta ships, and averaging it is exactly the bug.
    'Cost per Instagram Follows (IDR)': costPerFollow,
  };
}

const ROWS: SheetRow[] = [
  row('2026-07', 1_606_778, 600, 900),
  row('2026-07', 1_606_779, 619, 900),
  row('2026-08', 2_078_957, 640, 900),
  row('2026-08', 2_078_957, 654, 900),
];

function costPerFollowRow(rows: SheetRow[]) {
  const report = buildMetaReport({
    metaRows: rows,
    metaHeaders: Object.keys(rows[0]),
    cpasRows: null,
    cpasHeaders: [],
    industry: null,
    customResultsCol: null,
    objective: null,
    dayRanges: null,
  } as never) as never as {
    boost?: { detailedRows: { label: string; old: string; cur: string }[] };
    nonBoost?: { detailedRows: { label: string; old: string; cur: string }[] };
  };
  const section = report.boost ?? report.nonBoost;
  return section?.detailedRows.find((r) => /cost per instagram follows/i.test(r.label));
}

describe('Cost per Instagram Follows', () => {
  it('divides total spend by total follows instead of averaging Meta’s per-row value', () => {
    const found = costPerFollowRow(ROWS);
    expect(found).toBeDefined();
    // Rp3.213.557 / 1.219 and Rp4.157.914 / 1.294 — not Rp900, the per-row
    // value the old weighted-average fallback would have converged on.
    expect(found!.old).toBe('Rp2.636');
    expect(found!.cur).toBe('Rp3.213');
  });

  it('still resolves when the column uses the shorter “Cost per Follows” spelling', () => {
    const renamed = ROWS.map(({ 'Cost per Instagram Follows (IDR)': v, ...rest }) => ({
      ...rest,
      'Cost per Follows': v,
    })) as SheetRow[];
    const report = buildMetaReport({
      metaRows: renamed,
      metaHeaders: Object.keys(renamed[0]),
      cpasRows: null,
      cpasHeaders: [],
      industry: null,
      customResultsCol: null,
      objective: null,
      dayRanges: null,
    } as never) as never as {
      boost?: { detailedRows: { label: string; old: string; cur: string }[] };
      nonBoost?: { detailedRows: { label: string; old: string; cur: string }[] };
    };
    const section = report.boost ?? report.nonBoost;
    const found = section?.detailedRows.find((r) => /cost per follows/i.test(r.label));
    expect(found).toBeDefined();
    expect(found!.old).toBe('Rp2.636');
    expect(found!.cur).toBe('Rp3.213');
  });
});
