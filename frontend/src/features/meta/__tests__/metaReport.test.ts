import { describe, expect, it } from 'vitest';
import type { SheetRow } from '../../../lib/types';
import { buildMetaReport } from '../metaReport';

// One non-boost campaign, reached over several days with a large day-over-day
// overlap in the same audience (Reach barely moves day to day) — mirrors a
// real Meta Day-breakdown export, where naive summing of Reach across days
// wildly overcounts because the same people are reached repeatedly.
function dayRows(days: string[]): SheetRow[] {
  return days.map((day) => ({
    'Campaign name': 'RM | Sales - ATC | Jan26 | Artificial',
    Age: '25-34',
    Gender: 'female',
    Day: day,
    Reach: 9000,
    Impressions: 12000,
    Frequency: 1.33,
    'Amount Spent (IDR)': 100000,
  }));
}

const CAMPAIGN = 'RM | Sales - ATC | Jan26 | Artificial';

function monthRows(months: string[], withAgeGender = true): SheetRow[] {
  return months.map((month) => ({
    'Campaign name': CAMPAIGN,
    ...(withAgeGender ? { Age: '25-34', Gender: 'female' } : {}),
    Month: month,
    Reach: 9000,
    Impressions: 12000,
    Frequency: 1.33,
    'Amount Spent (IDR)': 100000,
  }));
}

// Two Age/Gender breakdown rows per month, no Age=All/Gender=All row — the
// approximation-prone shape reachApproxNote warns about (Reach here sums to
// 9000, not necessarily what Ads Manager's own collapsed figure would be).
function monthRowsBreakdownOnly(months: string[]): SheetRow[] {
  return months.flatMap((month) => [
    { 'Campaign name': CAMPAIGN, Age: '25-34', Gender: 'female', Month: month, Reach: 6000, Impressions: 8000, Frequency: 1.33, 'Amount Spent (IDR)': 60000 },
    { 'Campaign name': CAMPAIGN, Age: '35-44', Gender: 'male', Month: month, Reach: 3000, Impressions: 4000, Frequency: 1.33, 'Amount Spent (IDR)': 40000 },
  ]);
}

// Same breakdown rows, plus an explicit Age=All/Gender=All row — Reach
// should be read directly from that row (9500) instead of the breakdown sum
// (9000), the way Meta's Pivot Table "Ungroup Breakdowns" export can include.
function monthRowsWithAllRow(months: string[]): SheetRow[] {
  return months.flatMap((month) => [
    { 'Campaign name': CAMPAIGN, Age: 'All', Gender: 'All', Month: month, Reach: 9500, Impressions: 12500, Frequency: 1.32, 'Amount Spent (IDR)': 100000 },
    { 'Campaign name': CAMPAIGN, Age: '25-34', Gender: 'female', Month: month, Reach: 6000, Impressions: 8000, Frequency: 1.33, 'Amount Spent (IDR)': 60000 },
    { 'Campaign name': CAMPAIGN, Age: '35-44', Gender: 'male', Month: month, Reach: 3000, Impressions: 4000, Frequency: 1.33, 'Amount Spent (IDR)': 40000 },
  ]);
}

describe('buildMetaReport — Reach/Frequency reliability for Day-breakdown files', () => {
  it('sets reachWarning and drops Reach/Frequency/CPM-unrelated cols when old or cur spans more than one day', () => {
    const rows = [...dayRows(['2026-07-01', '2026-07-02', '2026-07-03']), ...dayRows(['2026-08-01', '2026-08-02', '2026-08-03'])];
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: {
        old: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 3) },
        cur: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 3) },
      },
    });

    expect(report.reachWarning).toBeTruthy();
    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('reach'))).toBe(false);
    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('frequency'))).toBe(false);
    // Impressions/Amount Spent are additive and unaffected — still offered.
    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('impression'))).toBe(true);
    expect(report.nonBoost?.detailedRows.some((r) => r.col.toLowerCase().includes('reach'))).toBe(false);
  });

  it('leaves Reach/Frequency available when both old and cur are single-day selections', () => {
    const rows = [...dayRows(['2026-07-01']), ...dayRows(['2026-08-01'])];
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: {
        old: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 1) },
        cur: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 1) },
      },
    });

    expect(report.reachWarning).toBeNull();
    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('reach'))).toBe(true);
  });

  it('never sets reachWarning for a Month-breakdown file (no Day column at all)', () => {
    const rows = monthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.reachWarning).toBeNull();
    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('reach'))).toBe(true);
  });
});

// Mirrors Meta's real "Formatted data table" export shape for one
// campaign+month: a Month="All" whole-period rollup row (must be excluded
// from old/cur entirely — see splitMonths), an Age=All/Gender=All row for
// that specific month, an intermediate Age-only rollup (Gender still
// "All"), and the fully granular Age+Gender rows — all four levels present
// simultaneously, the way the real file has them.
function hierarchicalMonthRows(months: string[]): SheetRow[] {
  return months.flatMap((month) => [
    { 'Campaign name': CAMPAIGN, Age: 'All', Gender: 'All', Month: 'All', Reach: 999999, 'Amount Spent (IDR)': 999999999 },
    { 'Campaign name': CAMPAIGN, Age: 'All', Gender: 'All', Month: month, Reach: 9500, 'Amount Spent (IDR)': 100000 },
    { 'Campaign name': CAMPAIGN, Age: '25-34', Gender: 'All', Month: month, Reach: 6500, 'Amount Spent (IDR)': 65000 },
    { 'Campaign name': CAMPAIGN, Age: '25-34', Gender: 'female', Month: month, Reach: 6000, 'Amount Spent (IDR)': 60000 },
    { 'Campaign name': CAMPAIGN, Age: '35-44', Gender: 'male', Month: month, Reach: 3000, 'Amount Spent (IDR)': 40000 },
  ]);
}

describe('buildMetaReport — a real "Formatted data table"-shaped file (4 nesting levels + a Month="All" rollup)', () => {
  it('reads every metric from the Age=All/Gender=All row per month, ignores the Month="All" rollup, and never double/triple-counts', () => {
    const rows = hierarchicalMonthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.p1).not.toContain('All');
    expect(report.p2).not.toContain('All');
    expect(report.reachApproxNote).toBeNull();
    expect(report.nonBoost?.detailedRows.find((r) => r.col === 'Reach')?.cur).toBe('9.500');
    expect(report.nonBoost?.detailedRows.find((r) => r.col === 'Amount Spent (IDR)')?.cur).toBe('Rp100.000');
  });

  it('never shows "All" as if it were a real age/gender segment in the breakdown cards', () => {
    // The Age=All/Gender=All row (and the Age-only Gender=All rollup) exist
    // for agg() to prefer — not to be rendered as their own demographic
    // bucket alongside 25-34, female, etc.
    const rows = hierarchicalMonthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.ageDemo?.rows.some((r) => r['Age'] === 'All')).toBe(false);
    expect(report.genderDemo?.rows.some((r) => r['Gender'] === 'All')).toBe(false);
  });
});

describe('buildMetaReport — never offers a metric the uploaded file doesn\'t actually have', () => {
  it('does not synthesize a CPM column when the file has no literal CPM data', () => {
    // Even though Amount Spent + Impressions are both present (enough to
    // compute CPM from), the file itself has no CPM column — the app should
    // only ever offer metrics that exist in the uploaded data.
    const rows = monthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.nonBoost?.allCols.some((c) => c.toLowerCase().includes('cpm'))).toBe(false);
  });
});

describe('buildMetaReport — Reach reads a campaign\'s Age=All/Gender=All row directly when present', () => {
  it('uses the "All" row\'s own Reach instead of summing the breakdown rows, and reachApproxNote stays null', () => {
    const rows = monthRowsWithAllRow(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.reachApproxNote).toBeNull();
    // 9,500 (the "All" row) — not 9,000 (the breakdown rows' sum).
    expect(report.nonBoost?.detailedRows.find((r) => r.col === 'Reach')?.cur).toBe('9.500');
  });
});

describe('buildMetaReport — reachApproxNote for Age/Gender-broken-down files', () => {
  // Verified against a real Meta export: SUM(Reach) across a campaign's
  // Age×Gender rows for July landed at 1,367,235, while Ads Manager's own
  // Age=All/Gender=All pivot for the same campaign+month reported 1,397,733
  // — Reach is Meta's own per-cell estimate, not a slice of an exact total,
  // so it doesn't sum back to the collapsed figure. reachApproxNote surfaces
  // that gap instead of silently showing a subtly-off number, for a campaign
  // whose file has no "All" row to read Reach from directly instead.
  it('is set for a Month-breakdown file with an Age/Gender breakdown and no "All" row', () => {
    const rows = monthRowsBreakdownOnly(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.reachApproxNote).toBeTruthy();
    // 9,000 — the breakdown rows summed, the only figure available.
    expect(report.nonBoost?.detailedRows.find((r) => r.col === 'Reach')?.cur).toBe('9.000');
  });

  it('is null when the file has no Age/Gender breakdown at all', () => {
    const rows = monthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15'], false);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.reachApproxNote).toBeNull();
  });

  it('is null when each campaign has only a single (non-"All") Age/Gender row — nothing was actually summed together', () => {
    const rows = monthRows(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: null,
    });

    expect(report.reachApproxNote).toBeNull();
  });

  it('stays null when reachWarning already fired, to avoid two overlapping messages', () => {
    const rows = [...dayRows(['2026-07-01', '2026-07-02', '2026-07-03']), ...dayRows(['2026-08-01', '2026-08-02', '2026-08-03'])];
    const headers = Object.keys(rows[0]);
    const report = buildMetaReport({
      metaRows: rows,
      metaHeaders: headers,
      cpasRows: null,
      cpasHeaders: [],
      industry: 'retail',
      customResultsCol: null,
      dayRanges: {
        old: { start: new Date(2026, 6, 1), end: new Date(2026, 6, 3) },
        cur: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 3) },
      },
    });

    expect(report.reachWarning).toBeTruthy();
    expect(report.reachApproxNote).toBeNull();
  });
});
