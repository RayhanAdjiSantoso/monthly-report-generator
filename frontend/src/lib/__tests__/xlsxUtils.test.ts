import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { firstSheetRows } from '../xlsxUtils';

function sheetFromRows(rows: unknown[][]): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return wb;
}

describe('firstSheetRows — sheet & header-row selection', () => {
  it('parses a normal file (header on row 1) exactly as before', () => {
    const wb = sheetFromRows([
      ['Campaign name', 'Amount Spent'],
      ['NV | Traffic', 100],
    ]);
    const rows = firstSheetRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 'Campaign name': 'NV | Traffic', 'Amount Spent': 100 });
  });

  it('skips a title-banner row and blank row to find the real header, like Meta\'s "Formatted data table" export', () => {
    const wb = sheetFromRows([
      ['Formatted report Jul-1-2026 to Aug-15-2026', 'Report Period: Jul 1, 2026 - Aug 15, 2026'],
      [],
      ['Campaign name', 'Month', 'Amount Spent'],
      ['NV | Traffic', '2026-07-01 - 2026-07-31', 100],
    ]);
    const rows = firstSheetRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ 'Campaign name': 'NV | Traffic', Month: '2026-07-01 - 2026-07-31', 'Amount Spent': 100 });
  });

  it('prefers a sheet literally named "Raw Data Report" over a "Formatted Report" sheet listed first', () => {
    const wb = XLSX.utils.book_new();
    const formatted = XLSX.utils.aoa_to_sheet([
      ['Campaign name', 'Month', 'Age', 'Gender', 'Amount Spent'],
      ['NV | Traffic', 'All', 'All', 'All', '999'], // merged-cell display style — not usable directly
    ]);
    const raw = XLSX.utils.aoa_to_sheet([
      ['Campaign name', 'Month', 'Age', 'Gender', 'Amount Spent'],
      ['NV | Traffic', '2026-07-01 - 2026-07-31', 'All', 'All', '100'],
    ]);
    XLSX.utils.book_append_sheet(wb, formatted, 'Formatted Report');
    XLSX.utils.book_append_sheet(wb, raw, 'Raw Data Report');

    const rows = firstSheetRows(wb);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Month']).toBe('2026-07-01 - 2026-07-31');
  });
});
