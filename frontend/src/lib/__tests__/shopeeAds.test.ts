import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { calcShopeeMetrics, detectShopeeHeaderRow, parseShopeeCSV, shopeeSum } from '../shopeeAds';

// Parses directly against the real sample exports in data/shopee-data-fin so a
// future change to Shopee's CSV format breaks this test instead of silently
// producing wrong numbers in a generated report.
const DATA_DIR = path.resolve(__dirname, '../../../../data/shopee-data-fin');
const tokoCSV = readFileSync(path.join(DATA_DIR, 'Iklan toko.csv'), 'utf-8');
const produkCSV = readFileSync(path.join(DATA_DIR, 'Iklan produk.csv'), 'utf-8');

describe('detectShopeeHeaderRow', () => {
  it('finds the header row after the metadata block', () => {
    expect(detectShopeeHeaderRow(tokoCSV)).toBe(7);
  });
});

describe('parseShopeeCSV — Iklan Toko', () => {
  const { rows, period } = parseShopeeCSV(tokoCSV);

  it('reads the period from the metadata block, keeping the real start/end dates (Fase 1)', () => {
    expect(period.label).toBe('Jul 2026'); // full calendar month, so this collapses same as before
    expect(period.start).toEqual(new Date(2026, 6, 1));
    expect(period.end).toEqual(new Date(2026, 6, 31));
    expect(period.days).toBe(31);
  });

  it('parses every data row (skipping the metadata header block)', () => {
    expect(rows.length).toBe(6);
  });

  it('sums Biaya using the exact-match column lookup (not "Biaya per Konversi")', () => {
    // Cross-checked independently against the raw CSV's Biaya column.
    expect(shopeeSum(rows, 'biaya')).toBe(8207232);
  });
});

describe('parseShopeeCSV — Iklan Produk', () => {
  const { rows, period } = parseShopeeCSV(produkCSV);

  it('reads the period from the metadata block', () => {
    expect(period.label).toBe('Jul 2026');
    expect(period.days).toBe(31);
  });

  it('parses every data row, including the "Iklan Produk Otomatis" subtotal row', () => {
    // Fase 3 will need to strip this row out after merging in the dedicated
    // Iklan Produk Otomatis file — parseShopeeCSV itself doesn't know about
    // that yet, so today it's still counted as a normal row.
    expect(rows.length).toBe(56);
    expect(rows.some((r) => r['Nama Iklan'] === 'Iklan Produk Otomatis')).toBe(true);
  });

  it('sums Biaya across all rows', () => {
    expect(shopeeSum(rows, 'biaya')).toBe(45767375);
  });
});

describe('parseShopeeCSV — partial-month period (Fase 1)', () => {
  it('keeps a partial-month range as a real range instead of collapsing to a month name', () => {
    const csv = [
      'Shop+ Ads Report - Shopee Indonesia',
      'Username,maiimi.id',
      'Nama Toko,Maiimi Official',
      'ID Toko,12126460',
      'Waktu Laporan Dibuat,21/08/2026 21:26',
      'Periode,01/07/2026 - 18/07/2026',
      '',
      'Urutan,Nama Iklan,Biaya',
      '1,Test Ad,100000',
    ].join('\n');
    const { period } = parseShopeeCSV(csv);
    expect(period.label).toBe('1-18 Jul 2026');
    expect(period.days).toBe(18);
  });
});

describe('calcShopeeMetrics', () => {
  it('combines Iklan Toko + Iklan Produk and derives ratio metrics from the omzet input', () => {
    const toko = parseShopeeCSV(tokoCSV).rows;
    const produk = parseShopeeCSV(produkCSV).rows;
    const omzetTotal = 100_000_000;
    const m = calcShopeeMetrics(toko, produk, omzetTotal);

    expect(m.biaya).toBe(8207232 + 45767375);
    expect(m.kontribusi).toBeCloseTo((m.penjualanAds / omzetTotal) * 100);
    expect(m.roas).toBeCloseTo(m.penjualanAds / m.biaya);
  });

  it('never divides by zero — all derived ratios default to 0 when their denominator is empty', () => {
    const m = calcShopeeMetrics([], [], 0);
    expect(m).toMatchObject({ biaya: 0, cpm: 0, ctr: 0, cpc: 0, cr: 0, cpo: 0, aov: 0, aur: 0, roas: 0, kontribusi: 0 });
  });
});
