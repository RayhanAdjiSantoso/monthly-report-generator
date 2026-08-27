import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { calcOverviewMetrics, parseOverviewNum, periodFromOverviewFilename } from '../shopeeOverview';
import type { SheetRow } from '../types';

const DATA_DIR = path.resolve(__dirname, '../../../../data/shopee-data-fin');

function readOverviewRows(): SheetRow[] {
  const buf = readFileSync(path.join(DATA_DIR, 'product overview.xlsx'));
  const wb = XLSX.read(buf, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' }) as SheetRow[];
}

describe('parseOverviewNum', () => {
  it('treats "." as thousands separator and "," as decimal (Indonesian format)', () => {
    expect(parseOverviewNum('25.297.000')).toBe(25297000);
    expect(parseOverviewNum('24,39%')).toBeCloseTo(24.39);
  });
});

describe('periodFromOverviewFilename', () => {
  it('collapses a same-month date range', () => {
    expect(periodFromOverviewFilename('overview_20260701_20260731.xlsx')).toBe('Jul 2026');
  });
  it('spans two months when the range crosses a month boundary', () => {
    expect(periodFromOverviewFilename('overview_20260615_20260714.xlsx')).toBe('Jun–Jul 2026');
  });
  it('returns empty string when no date range is found', () => {
    expect(periodFromOverviewFilename('overview.xlsx')).toBe('');
  });
});

describe('calcOverviewMetrics — real product overview.xlsx', () => {
  const rows = readOverviewRows();

  it('reads all 31 daily rows', () => {
    expect(rows.length).toBe(31);
  });

  it('sums each metric column across the whole period', () => {
    const m = calcOverviewMetrics(rows);
    expect(m).not.toBeNull();
    // Cross-checked independently against the raw .xlsx cell values.
    expect(m!.pengunjung).toBe(53570);
    expect(m!.produkDilihat).toBe(136744);
    expect(m!.purchaseValue).toBe(461571600);
  });

  it('returns null for an empty sheet', () => {
    expect(calcOverviewMetrics([])).toBeNull();
  });
});
