import { describe, expect, it } from 'vitest';
import { agg, aggSum, buildCprRow, buildKPI, defaultMetaDayRanges, displayName, fmt, getOverviewDefs, isNumericCol, isSkip, metaDayRange, parseMetaDayValue, parseMetaMonthValue, parseNum, splitByDayRange, splitMonths } from '../meta';
import type { SheetRow } from '../types';

describe('parseMetaDayValue', () => {
  it('parses a bare "YYYY-MM-DD" string', () => {
    expect(parseMetaDayValue('2026-08-15')).toEqual(new Date(2026, 7, 15));
  });
  it('decodes an Excel serial date number the same way parseMetaMonthValue does', () => {
    expect(parseMetaDayValue(46174)).toEqual(new Date(2026, 5, 1));
  });
  it('returns null for a blank cell', () => {
    expect(parseMetaDayValue('')).toBeNull();
  });
});

describe('metaDayRange', () => {
  it('finds the min/max Day across a day-breakdown file, ignoring blank rows', () => {
    const rows: SheetRow[] = [{ Day: '2026-07-05' }, { Day: '2026-08-15' }, { Day: '2026-07-01' }, { Day: '' }];
    const range = metaDayRange(rows, 'Day');
    expect(range).toEqual({ min: new Date(2026, 6, 1), max: new Date(2026, 7, 15) });
  });
});

describe('defaultMetaDayRanges', () => {
  it('splits a range crossing a month boundary into "full first month" old vs "rest" cur — reproduces the real Jul1-Aug15 2026 file', () => {
    const { old, cur } = defaultMetaDayRanges(new Date(2026, 6, 1), new Date(2026, 7, 15));
    expect(old).toEqual({ start: new Date(2026, 6, 1), end: new Date(2026, 6, 31) });
    expect(cur).toEqual({ start: new Date(2026, 7, 1), end: new Date(2026, 7, 15) });
  });

  it('falls back to an even day-count split when the range stays within one month', () => {
    const { old, cur } = defaultMetaDayRanges(new Date(2026, 6, 1), new Date(2026, 6, 10));
    expect(old).toEqual({ start: new Date(2026, 6, 1), end: new Date(2026, 6, 5) });
    expect(cur).toEqual({ start: new Date(2026, 6, 6), end: new Date(2026, 6, 10) });
  });
});

describe('splitByDayRange', () => {
  it('buckets rows into old/cur by whichever custom date range each falls in', () => {
    const rows: SheetRow[] = [
      { Day: '2026-07-01', 'Amount Spent': '10' },
      { Day: '2026-07-10', 'Amount Spent': '20' },
      { Day: '2026-08-01', 'Amount Spent': '30' },
      { Day: '2026-08-10', 'Amount Spent': '40' },
    ];
    const { old, cur } = splitByDayRange(
      rows,
      'Day',
      { start: new Date(2026, 6, 1), end: new Date(2026, 6, 10) },
      { start: new Date(2026, 7, 1), end: new Date(2026, 7, 10) },
    );
    expect(old).toHaveLength(2);
    expect(cur).toHaveLength(2);
    expect(old.map((r) => r['Amount Spent'])).toEqual(['10', '20']);
    expect(cur.map((r) => r['Amount Spent'])).toEqual(['30', '40']);
  });

  it('supports a narrower custom sub-range than the full available span', () => {
    const rows: SheetRow[] = [
      { Day: '2026-07-01', 'Amount Spent': '10' },
      { Day: '2026-07-05', 'Amount Spent': '20' },
      { Day: '2026-07-10', 'Amount Spent': '30' },
    ];
    const { old } = splitByDayRange(rows, 'Day', { start: new Date(2026, 6, 1), end: new Date(2026, 6, 5) }, { start: new Date(2026, 6, 6), end: new Date(2026, 6, 10) });
    expect(old.map((r) => r['Amount Spent'])).toEqual(['10', '20']);
  });
});

describe('parseMetaMonthValue', () => {
  it('treats a bare "YYYY-MM-DD" (day 1) as the whole month', () => {
    const p = parseMetaMonthValue('2026-07-01');
    expect(p.label).toBe('Jul 2026');
    expect(p.days).toBe(31);
  });

  it('decodes an Excel serial date number the same way — SheetJS auto-converts date-looking cells to these', () => {
    // 46174 / 46204 are the real values SheetJS produces for "2026-06-01" and
    // "2026-07-01" respectively (verified against XLSX.SSF.parse_date_code).
    expect(parseMetaMonthValue(46174).label).toBe('Jun 2026');
    expect(parseMetaMonthValue(46204).label).toBe('Jul 2026');
  });

  it('reads Meta\'s own range-string format for a partial month, verified against a real "Aug 1-15 2026" export', () => {
    const p = parseMetaMonthValue('2026-08-01 - 2026-08-15');
    // Same Indonesian month abbreviations as Shopee/TikTok (shared formatPeriodLabel).
    expect(p.label).toBe('1-15 Ags 2026');
    expect(p.days).toBe(15);
  });

  it('reads a range string spanning two different months', () => {
    const p = parseMetaMonthValue('2026-07-16 - 2026-08-15');
    expect(p.label).toBe('16 Jul-15 Ags 2026');
    expect(p.days).toBe(31);
  });

  it('returns an empty period for a blank cell (e.g. the account-summary row Meta includes with no breakdown dimensions filled in)', () => {
    const p = parseMetaMonthValue('');
    expect(p.label).toBe('');
    expect(p.days).toBeNull();
  });
});

describe('splitMonths', () => {
  it('orders old/cur by actual date even when one bucket is a bare date and the other a partial-month range string', () => {
    // Reproduces a real bug: SheetJS auto-converts a bare "2026-06-01" cell to
    // an Excel serial number (46174) but leaves a range string like
    // "2026-08-01 - 2026-08-15" as text. A plain .sort() stringifies both
    // ("46174" vs "2026-08-01 - 2026-08-15") and — because "4" > "2" as the
    // first character — puts August before June, silently swapping which
    // period is "old" and which is "cur".
    const rows: SheetRow[] = [
      { Month: 46174, 'Amount Spent': '100' }, // 2026-06-01 as an Excel serial
      { Month: '2026-08-01 - 2026-08-15', 'Amount Spent': '200' },
    ];
    const { old, cur, months } = splitMonths(rows, 'Month');
    expect(parseMetaMonthValue(months[0]).label).toBe('Jun 2026');
    expect(parseMetaMonthValue(months[months.length - 1]).label).toBe('1-15 Ags 2026');
    expect(old[0]['Amount Spent']).toBe('100');
    expect(cur[0]['Amount Spent']).toBe('200');
  });

  it('excludes a Month="All" rollup row from being picked as a real old/cur month', () => {
    // Meta's "Formatted data table" export includes a per-campaign
    // Month="All" row (a whole-file-period total, not any single month)
    // alongside the real per-month rows. Its unparseable date used to fall
    // back to a string compare against real ISO date-range strings — since
    // digits sort before letters, "All" landed after every real month and
    // got picked as ms[last], silently making `cur` the wrong rows.
    const rows: SheetRow[] = [
      { Month: 'All', 'Amount Spent': '999' },
      { Month: '2026-07-01 - 2026-07-31', 'Amount Spent': '100' },
      { Month: '2026-08-01 - 2026-08-15', 'Amount Spent': '200' },
    ];
    const { old, cur, months } = splitMonths(rows, 'Month');
    expect(months).toEqual(['2026-07-01 - 2026-07-31', '2026-08-01 - 2026-08-15']);
    expect(old[0]['Amount Spent']).toBe('100');
    expect(cur[0]['Amount Spent']).toBe('200');
  });
});

describe('displayName', () => {
  it('matches the more specific "with shared items" pattern before the base one', () => {
    // RENAME_MAP order matters: "purchases with shared items" must win over
    // the bare "purchases" pattern, since the latter is also a substring match.
    expect(displayName('Purchases with Shared Items')).toBe('Purchases');
    expect(displayName('Cost per Purchase with Shared Items')).toBe('Cost per Purchase');
  });

  it('falls back to the raw column name when nothing matches', () => {
    expect(displayName('Some Unmapped Column')).toBe('Some Unmapped Column');
  });
});

describe('isSkip', () => {
  it('skips known dimension/meta columns', () => {
    expect(isSkip('Reporting Starts')).toBe(true);
    expect(isSkip('Month')).toBe(true);
    expect(isSkip('Campaign Name')).toBe(true);
  });
  it('does not skip metric columns', () => {
    expect(isSkip('Amount Spent')).toBe(false);
  });
});

describe('parseNum', () => {
  it('returns null for empty/undefined (unlike the Shopee parsers, which default to 0)', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum(undefined)).toBeNull();
  });
  it('strips "Rp", whitespace and thousands commas', () => {
    expect(parseNum('Rp 1,234')).toBe(1234);
  });
  it('parses percentages', () => {
    expect(parseNum('12.34%')).toBeCloseTo(12.34);
  });
});

describe('isNumericCol', () => {
  const rows: SheetRow[] = [{ 'Amount Spent': '100' }, { 'Amount Spent': '200' }];
  it('detects a metric column with parseable values', () => {
    expect(isNumericCol('Amount Spent', rows)).toBe(true);
  });
  it('rejects skip columns regardless of content', () => {
    expect(isNumericCol('Month', [{ Month: '2026-01-01' }])).toBe(false);
  });
});

describe('agg — "cost per X" self-match guard', () => {
  it('does not treat an unmapped "Cost per X" column as its own denominator', () => {
    // Only column containing "checkout initiated" is the cost column itself —
    // the true denom ("Checkouts Initiated", plural) is absent from this file.
    const rows: SheetRow[] = [{ 'Amount Spent': '100', 'Cost per Checkout Initiated': '5' }];
    expect(agg(rows, 'Cost per Checkout Initiated')).toBeNull();
  });

  it('resolves once the real denominator column is present', () => {
    const rows: SheetRow[] = [
      { 'Amount Spent': '100', 'Cost per Checkout Initiated': '5', 'Checkouts Initiated': '20' },
      { 'Amount Spent': '100', 'Cost per Checkout Initiated': '5', 'Checkouts Initiated': '20' },
    ];
    // SUM(Amount Spent) / SUM(Checkouts Initiated) = 200 / 40 = 5
    expect(agg(rows, 'Cost per Checkout Initiated')).toBe(5);
  });

  it('generic fallback also guards against self-match for unmapped "cost per" columns', () => {
    const rows: SheetRow[] = [{ 'Amount Spent': '100', 'Cost per Foo': '5' }];
    expect(agg(rows, 'Cost per Foo')).toBeNull();
    const rowsWithDenom: SheetRow[] = [{ 'Amount Spent': '100', 'Cost per Foo': '5', 'Foo Total': '10' }];
    expect(agg(rowsWithDenom, 'Cost per Foo')).toBe(10); // 100/10
  });
});

describe('agg — CPM computed from Spent/Impressions', () => {
  it('computes CPM even without a literal CPM column', () => {
    const rows: SheetRow[] = [{ 'Amount Spent': '50', Impressions: '10000' }];
    expect(agg(rows, 'CPM (Cost per 1,000 Impressions)')).toBe(5);
  });
});

describe('agg — Frequency computed from Impressions/Reach', () => {
  it('weights by Impressions/Reach instead of averaging per-row Frequency, so a huge campaign/age/gender breakdown row is not diluted by many tiny ones', () => {
    // Mirrors a real Meta campaign/age/gender breakdown export: one large row
    // and several tiny ones. A plain average of the Frequency column would
    // land near 1.3 (dominated by the tiny rows); Impressions/Reach correctly
    // reflects the large row.
    const rows: SheetRow[] = [
      { Reach: '9196', Impressions: '12638', Frequency: '1.37' },
      { Reach: '36', Impressions: '46', Frequency: '1.28' },
      { Reach: '8', Impressions: '17', Frequency: '2.13' },
      { Reach: '6', Impressions: '6', Frequency: '1.00' },
    ];
    const totalReach = 9196 + 36 + 8 + 6;
    const totalImpr = 12638 + 46 + 17 + 6;
    expect(agg(rows, 'Frequency')).toBeCloseTo(totalImpr / totalReach, 6);
  });

  it('falls back to a simple row average when there is no Reach/Impressions column to weight by', () => {
    const rows: SheetRow[] = [{ Frequency: '1.0' }, { Frequency: '2.0' }];
    expect(agg(rows, 'Frequency')).toBe(1.5);
  });
});

describe('aggSum — prefers a campaign\'s Age=All/Gender=All row for ANY metric, not just Reach', () => {
  // Reproduces Meta's "Formatted data table" export: for one campaign+month
  // it has THREE nesting levels at once — an Age=All/Gender=All row, an
  // intermediate Age-specific/Gender=All rollup, and the fully granular
  // Age+Gender rows. Naively summing every row for that campaign would
  // triple-count Amount Spent (the same money counted once at each nesting
  // level); aggSum must read the All row directly instead.
  const rows: SheetRow[] = [
    { 'Campaign name': 'NV | Traffic - Profile Visit', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', Reach: 1397733, 'Amount Spent': '19554143' },
    { 'Campaign name': 'NV | Traffic - Profile Visit', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'All', Reach: 1004993, 'Amount Spent': '11754754' },
    { 'Campaign name': 'NV | Traffic - Profile Visit', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'female', Reach: 765325, 'Amount Spent': '9000000' },
    { 'Campaign name': 'NV | Traffic - Profile Visit', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'male', Reach: 226093, 'Amount Spent': '2754754' },
  ];

  it('reads Amount Spent from the "All" row (19,554,143), not a multi-level-double-counted sum', () => {
    expect(aggSum(rows, 'Amount Spent')).toBe(19554143);
  });

  it('reads Reach from the "All" row (1,397,733) the same way', () => {
    expect(aggSum(rows, 'Reach')).toBe(1397733);
  });

  it('falls back to summing only the fully granular rows — never an intermediate Age-only rollup — when there is no "All" row', () => {
    const noAllRow = rows.slice(1); // drop the Age=All/Gender=All row
    // 765,325 + 226,093 = 991,418 (the two Gender-specific rows) — NOT
    // + 1,004,993 (the Age=25-34/Gender=All row), which would double-count.
    expect(aggSum(noAllRow, 'Reach')).toBe(991418);
  });
});

describe('agg — CTR/CPC/ratio columns fall back to reading the file\'s own value when there is no raw Clicks/denominator column', () => {
  // Mirrors a real Meta "Formatted data table" export: it has "CTR (all)"
  // and "CPC (all)" columns with Meta's own pre-computed values, but no bare
  // "Clicks"/"Link clicks" count column anywhere to recompute them from —
  // agg() used to give up and return null ("—") in that case. It should
  // instead read the campaign's own Age=All/Gender=All row directly.
  const rows: SheetRow[] = [
    { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', Impressions: 2233713, 'CTR (all)': 1.7765935, 'CPC (all)': 492.74627054, 'Amount spent (IDR)': 19554143 },
    { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'female', Impressions: 1289246, 'CTR (all)': 1.64344121, 'CPC (all)': 450.58872947, 'Amount spent (IDR)': 9547074 },
  ];

  it('reads CTR (all) from the "All" row (1.78%) instead of returning "—"', () => {
    expect(agg(rows, 'CTR (all)')).toBeCloseTo(1.7765935, 6);
  });

  it('reads CPC (all) from the "All" row instead of returning "—"', () => {
    expect(agg(rows, 'CPC (all)')).toBeCloseTo(492.74627054, 6);
  });

  it('falls back to an Impressions-weighted average across campaigns when there is no "All" row', () => {
    const twoCampaignsNoAllRow: SheetRow[] = [
      { 'Campaign name': 'A', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'female', Impressions: 1000, 'CTR (all)': 2 },
      { 'Campaign name': 'B', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'female', Impressions: 3000, 'CTR (all)': 4 },
    ];
    // (2*1000 + 4*3000) / (1000+3000) = 3.5 — not a plain average (3).
    expect(agg(twoCampaignsNoAllRow, 'CTR (all)')).toBeCloseTo(3.5, 6);
  });

  it('reads "Cost per add to cart" from the "All" row when the file has no bare "Adds to cart" count column', () => {
    const rowsWithCostPerAtc: SheetRow[] = [
      { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', Impressions: 2233713, 'Amount spent (IDR)': 19554143, 'Cost per add to cart': 9777071.5 },
    ];
    expect(agg(rowsWithCostPerAtc, 'Cost per add to cart')).toBeCloseTo(9777071.5, 3);
  });

  it('"View content to ATC ratio" reads the "All" row instead of averaging every breakdown row unweighted, when Content Views isn\'t in the file to derive it from', () => {
    // Reproduces the real bug: many near-zero granular rows used to drag a
    // plain average down to 0.01%, when the campaign's own Age=All/Gender=All
    // row (and Ads Manager) both say 0.00952381 (0.95%). No "Content views"
    // column here, so this exercises the Impressions-weighted last resort
    // (see the next describe block for the exact Content-Views-derived path).
    const rowsWithRatio: SheetRow[] = [
      { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', Impressions: 2233713, 'View content to ATC ratio': 0.00952381 },
      { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: '25-34', Gender: 'female', Impressions: 1289246, 'View content to ATC ratio': 0 },
      { 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', Age: '65+', Gender: 'unknown', Impressions: 17, 'View content to ATC ratio': 2.125 },
    ];
    expect(agg(rowsWithRatio, 'View content to ATC ratio')).toBeCloseTo(0.00952381, 6);
  });
});

describe('agg — CTR/CPC/"Cost per X" stay exact across many small groups with NO "All" row at all (a Day-breakdown export)', () => {
  // Mirrors a real Meta Day-breakdown "Formatted data table" export: its
  // Age=All/Gender=All row only exists for Day="All" (the whole exported
  // file period), which a specific old/cur date-range selection excludes —
  // so every single day's rows fall into the "no All row" fallback branch.
  // Two days, two Age×Gender rows each, no "All" row anywhere in this data.
  const rows: SheetRow[] = [
    { 'Campaign name': 'A', Day: '2026-07-01', Age: '25-34', Gender: 'female', Impressions: 1000, 'CTR (all)': 1.0, 'CPC (all)': 500, 'Amount spent (IDR)': 100000, 'Cost per add to cart': 50000 },
    { 'Campaign name': 'A', Day: '2026-07-01', Age: '45-54', Gender: 'male', Impressions: 9000, 'CTR (all)': 3.0, 'CPC (all)': 300, 'Amount spent (IDR)': 900000, 'Cost per add to cart': 300000 },
    { 'Campaign name': 'A', Day: '2026-07-02', Age: '25-34', Gender: 'female', Impressions: 2000, 'CTR (all)': 1.0, 'CPC (all)': 500, 'Amount spent (IDR)': 200000, 'Cost per add to cart': 100000 },
    { 'Campaign name': 'A', Day: '2026-07-02', Age: '45-54', Gender: 'male', Impressions: 8000, 'CTR (all)': 3.0, 'CPC (all)': 300, 'Amount spent (IDR)': 800000, 'Cost per add to cart': 200000 },
  ];
  // Implied Clicks per row = CTR/100 × Impressions:
  //   day1: 10 + 270 = 280   day2: 20 + 240 = 260   → total Impressions 20000, total Clicks 540
  // Implied Adds to Cart per row = Spend/CostPerATC:
  //   day1: 2 + 3 = 5   day2: 2 + 4 = 6   → total Spend 2,000,000, total ATC 11

  it('CTR (all): weights every row individually, not a plain per-day average then a second weighting pass', () => {
    // A plain unweighted per-day average (the previous bug) would land near
    // 2% (averaging 1% and 3% each day); weighting every row by its own
    // Impressions from the start gives the true combined CTR instead.
    expect(agg(rows, 'CTR (all)')).toBeCloseTo((540 / 20000) * 100, 6);
  });

  it('CPC (all): derives Clicks via CTR×Impressions (exact) instead of weight-averaging CPC by Impressions (only approximate)', () => {
    expect(agg(rows, 'CPC (all)')).toBeCloseTo(2000000 / 540, 6);
  });

  it('"Cost per add to cart": sums Spend/CostPerATC per row instead of averaging CostPerATC across a day\'s rows first', () => {
    expect(agg(rows, 'Cost per add to cart')).toBeCloseTo(2000000 / 11, 6);
  });
});

describe('agg — "Cost per X"/ratio columns recompute exactly from concept counts across MULTIPLE campaigns, instead of weight-averaging a percentage', () => {
  // Two non-boost campaigns, each with its own Age=All/Gender=All row (only
  // Amount Spent, "Cost per X", and Content Views — everything the concept
  // derivation needs; no bare "Adds to cart"/"Purchases" count column
  // anywhere, matching a real Meta export). Campaign B has no purchase data
  // at all (blank "Cost per purchase"), the way most real campaigns in a
  // large account don't convert every action — its spend still counts
  // toward the blended Cost per Purchase, but not toward the purchase count.
  const rows: SheetRow[] = [
    { 'Campaign name': 'A', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', 'Amount spent (IDR)': 100000, 'Cost per add to cart': 50000, 'Cost per purchase': 100000, 'Content views': 500 },
    { 'Campaign name': 'B', Month: '2026-07-01 - 2026-07-31', Age: 'All', Gender: 'All', 'Amount spent (IDR)': 200000, 'Cost per add to cart': 100000, 'Cost per purchase': '', 'Content views': 1500 },
  ];
  // Implied Adds to Cart: A=100000/50000=2, B=200000/100000=2 → total 4.
  // Implied Purchases: A=100000/100000=1, B has none → total 1.

  it('"Cost per add to cart": SUM(Spend)/SUM(implied ATC) = 300,000/4 = Rp75,000 — not a self-matched or Impressions-weighted guess', () => {
    expect(agg(rows, 'Cost per add to cart')).toBeCloseTo(75000, 6);
  });

  it('"Cost per purchase": SUM(Spend across BOTH campaigns)/SUM(implied Purchases, only from campaign A) = 300,000/1', () => {
    expect(agg(rows, 'Cost per purchase')).toBeCloseTo(300000, 6);
  });

  it('"View content to ATC ratio": SUM(implied ATC)/SUM(Content Views) = 4/2000 = 0.2%, derived from Content Views (the ratio\'s real denominator), not Impressions', () => {
    expect(agg(rows, 'View content to ATC ratio')).toBeCloseTo(0.002, 6);
  });

  it('"ATC to Purchase ratio": SUM(implied Purchases)/SUM(implied ATC) = 1/4 = 25%, derived purely from two "Cost per X" columns', () => {
    expect(agg(rows, 'ATC to Purchase ratio')).toBeCloseTo(0.25, 6);
  });
});

describe('agg — "Cost per Purchase" no longer self-matches an unrelated "…Purchase ratio"/"…conversion value" column as its denominator', () => {
  it('falls back to reading the file\'s own value instead of computing Spend ÷ SUM("ATC to Purchase ratio")', () => {
    // Reproduces a real bug: with no bare "Purchases" count column, the old
    // findDenomCol matched "ATC to Purchase ratio" (column order put it
    // first) as if it were a purchase count to divide spend by, producing a
    // nonsense number instead of falling back safely.
    const rows: SheetRow[] = [
      {
        'Campaign name': 'A',
        Month: '2026-07-01 - 2026-07-31',
        Age: 'All',
        Gender: 'All',
        'Amount spent (IDR)': 100000,
        'ATC to Purchase ratio': 0.5,
        'Purchases conversion value': 250000,
        'Cost per purchase': 100000,
      },
    ];
    // Reads the file's own "Cost per purchase" (100,000) directly — not
    // 100000/0.5=200000 (self-matched against the ratio column) or
    // 100000/250000 (self-matched against the conversion value column).
    expect(agg(rows, 'Cost per purchase')).toBeCloseTo(100000, 6);
  });
});

describe('fmt — "ratio" columns are a 0–1 fraction, unlike "ctr" columns which are already percentage points', () => {
  it('multiplies a "ratio" column by 100 (0.00952381 → "0,95%"), matching Ads Manager', () => {
    expect(fmt(0.00952381, 'View content to ATC ratio')).toBe('0,95%');
  });

  it('does NOT multiply a "ctr" column (1.7765935 → "1,78%", not "177,66%")', () => {
    expect(fmt(1.7765935, 'CTR (all)')).toBe('1,78%');
  });
});

describe('fmt — Meta numbers use "." as the thousands separator and "," as the decimal separator', () => {
  it('formats Frequency with a comma decimal (1.6 → "1,60")', () => {
    expect(fmt(1.6, 'Frequency')).toBe('1,60');
  });

  it('formats ROAS with a comma decimal (2.5 → "2,50x")', () => {
    expect(fmt(2.5, 'ROAS')).toBe('2,50x');
  });

  it('still uses "." for the thousands separator on Rupiah amounts (unaffected by the decimal-separator fix)', () => {
    expect(fmt(19554143, 'Amount Spent (IDR)')).toBe('Rp19.554.143');
  });
});

describe('buildKPI', () => {
  it('aggregates old vs cur and computes a signed delta', () => {
    const old: SheetRow[] = [{ 'Amount Spent': '100' }];
    const cur: SheetRow[] = [{ 'Amount Spent': '150' }];
    const rows = buildKPI(old, cur, ['Amount Spent']);
    expect(rows).toHaveLength(1);
    // Meta's delta % uses "," for the decimal separator (id-ID convention),
    // unlike computeDelta's own shared dot-decimal deltaStr — see buildKPI.
    expect(rows[0]).toMatchObject({ col: 'Amount Spent', old: 'Rp100', val: 'Rp150', delta: '+50,00%', deltaNum: 50 });
  });
});

describe('buildCprRow', () => {
  it('formats its delta % with a comma decimal too, same as buildKPI', () => {
    const old: SheetRow[] = [{ Spent: '100', Denom: '10' }]; // Cost per Denom = 10
    const cur: SheetRow[] = [{ Spent: '150', Denom: '10' }]; // Cost per Denom = 15 (+50%)
    const row = buildCprRow({ spent: 'Spent', denom: 'Denom', label: 'Cost per Denom' }, old, cur);
    expect(row).toMatchObject({ old: 'Rp10', cur: 'Rp15', delta: '+50,00%', deltaNum: 50 });
  });
});

describe('getOverviewDefs', () => {
  it('builds the retail overview (Amount Spent + Purchases) with a Cost per Purchase pair', () => {
    const defs = getOverviewDefs('retail', ['Amount Spent', 'Purchases'], null);
    expect(defs.main?.cols).toEqual(['Amount Spent', 'Purchases']);
    expect(defs.main?.cprPair).toMatchObject({ spent: 'Amount Spent', denom: 'Purchases', label: 'Cost per Purchase' });
  });

  it('custom industry uses the user-picked results column', () => {
    const defs = getOverviewDefs('custom', ['Amount Spent', 'My Custom Result'], 'My Custom Result');
    expect(defs.main?.cols).toEqual(['Amount Spent', 'My Custom Result']);
    expect(defs.main?.cprPair).toMatchObject({ denom: 'My Custom Result', label: 'Cost per Result' });
  });

  it('does not pick "Purchases conversion value" as the Purchases *count* when there is no bare "Purchases" column', () => {
    // Reproduces a real bug: with no bare "Purchases" column, `find` matched
    // "Purchases conversion value" (a dollar amount) as the retail overview's
    // "Cost per Purchase" denominator, producing a nonsense Spend ÷
    // ConversionValue instead of a real cost-per-purchase. Failing safely to
    // no cprPair at all (the Detailed table's own "Cost per purchase" column
    // still computes correctly, see agg()'s concept-derived fallback) is
    // better than showing a wrong number in the Overview.
    const defs = getOverviewDefs('retail', ['Amount Spent', 'Purchases conversion value', 'Cost per purchase'], null);
    expect(defs.main?.cols).toEqual(['Amount Spent']);
    expect(defs.main?.cprPair?.denom).toBeNull();
  });
});
