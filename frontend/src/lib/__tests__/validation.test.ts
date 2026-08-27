import { describe, expect, it } from 'vitest';
import { validateFileBasics, requireColumns, MAX_FILE_SIZE_BYTES } from '../validation';
import type { SheetRow } from '../types';

describe('validateFileBasics', () => {
  it('rejects an unsupported extension', () => {
    const r = validateFileBasics({ name: 'report.pdf', size: 100 }, ['.csv', '.xlsx']);
    expect(r.ok).toBe(false);
  });
  it('rejects an empty file', () => {
    const r = validateFileBasics({ name: 'report.csv', size: 0 }, ['.csv']);
    expect(r.ok).toBe(false);
  });
  it('rejects a file over the size cap', () => {
    const r = validateFileBasics({ name: 'report.csv', size: MAX_FILE_SIZE_BYTES + 1 }, ['.csv']);
    expect(r.ok).toBe(false);
  });
  it('accepts a normal csv', () => {
    const r = validateFileBasics({ name: 'report.csv', size: 1024 }, ['.csv', '.xlsx']);
    expect(r.ok).toBe(true);
  });
});

describe('requireColumns', () => {
  const rows: SheetRow[] = [{ 'Amount Spent': '100', Month: '2026-01-01' }];
  it('passes when every required column is present', () => {
    const r = requireColumns(rows, [{ label: 'Amount Spent', kw: ['amount spent'] }]);
    expect(r.ok).toBe(true);
  });
  it('reports every missing column by label', () => {
    const r = requireColumns(rows, [
      { label: 'Amount Spent', kw: ['amount spent'] },
      { label: 'Campaign Name', kw: ['campaign'] },
    ]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain('Campaign Name');
  });
});
