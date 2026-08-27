import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseShopeeCSV } from '../shopeeAds';
import { buildDailyTrendPivot, collectAdvertisedProductCodes, findUnadvertisedVariants, rankVariantsBySiapDikirim, type DailyTrendMetricSelection } from '../shopeeDeepDiveInsights';
import type { SheetRow } from '../types';

const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);
function readXlsxSheet(file: string, sheetName: string): SheetRow[] {
  const buf = readFileSync(fileURLToPath(new URL(file, FIXTURES)));
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[sheetName], { defval: '' });
}
function readFixtureText(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), 'utf8');
}

describe('rankVariantsBySiapDikirim — real "Produk dengan Performa Terbaik" sheet', () => {
  const rows = readXlsxSheet('product-performance.xlsx', 'Produk dengan Performa Terbaik');
  const ranked = rankVariantsBySiapDikirim(rows);

  it('drops product-level aggregate rows (Kode Variasi === "-") and keeps only real variant rows', () => {
    // Ground truth counted independently from the fixture: 179 total rows, 86 real variant rows.
    expect(ranked).toHaveLength(86);
  });

  it('sorts by Penjualan (Pesanan Siap Dikirim) descending', () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i].penjualanSiapDikirim).toBeLessThanOrEqual(ranked[i - 1].penjualanSiapDikirim);
    }
  });

  it('parses the top variant correctly (Indonesian-locale "37.715.929" -> 37715929)', () => {
    expect(ranked[0]).toMatchObject({ kodeProduk: '50458878752', namaVariasi: 'BB+NIB100ML', penjualanSiapDikirim: 37715929 });
  });
});

describe('collectAdvertisedProductCodes + findUnadvertisedVariants — real cross-check', () => {
  const produk = parseShopeeCSV(readFixtureText('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readFixtureText('iklan-produk-otomatis.csv')).rows;
  const toko = parseShopeeCSV(readFixtureText('iklan-toko.csv')).rows;
  const live = parseShopeeCSV(readFixtureText('iklan-live.csv')).rows;
  const kw = parseShopeeCSV(readFixtureText('iklan-toko-keyword.csv')).rows;
  const advertised = collectAdvertisedProductCodes(produk, otomatis, toko, live, kw);

  it('only finds Kode Produk from channels that actually have that column (Toko/Live/Keyword real exports have none)', () => {
    // Ground truth counted independently: 56 distinct advertised product codes across Produk + Produk Otomatis.
    expect(advertised.size).toBe(56);
  });

  it('flags 5 real variant rows as sold-but-never-advertised, all ranked-highest-first', () => {
    const rows = readXlsxSheet('product-performance.xlsx', 'Produk dengan Performa Terbaik');
    const ranked = rankVariantsBySiapDikirim(rows);
    const unadvertised = findUnadvertisedVariants(ranked, advertised);
    expect(unadvertised).toHaveLength(5);
    expect(unadvertised.every((v) => v.kodeProduk === '23451626161' || v.kodeProduk === '45602963557')).toBe(true);
    // still sorted by revenue within the filtered subset
    for (let i = 1; i < unadvertised.length; i++) {
      expect(unadvertised[i].penjualanSiapDikirim).toBeLessThanOrEqual(unadvertised[i - 1].penjualanSiapDikirim);
    }
  });

  it('does NOT flag the top-selling variant, which really is advertised in the real data', () => {
    const rows = readXlsxSheet('product-performance.xlsx', 'Produk dengan Performa Terbaik');
    const ranked = rankVariantsBySiapDikirim(rows);
    const unadvertised = findUnadvertisedVariants(ranked, advertised);
    expect(unadvertised.some((v) => v.kodeProduk === '50458878752')).toBe(false);
  });
});

describe('Tingkatkan dengan Iklan sheet', () => {
  it('reads as empty in this real file, matching what the user described', () => {
    const rows = readXlsxSheet('product-performance.xlsx', 'Tingkatkan dengan Iklan');
    expect(rows).toHaveLength(0);
  });
});

describe('buildDailyTrendPivot — real "overview" sheet, day-aligned side-by-side pivot', () => {
  const rows = readXlsxSheet('product-overview.xlsx', 'overview');

  it('builds a 31-row pivot (day-of-month 1..31) when both periods are the same real July export', () => {
    const pivot = buildDailyTrendPivot(rows, rows);
    expect(pivot).toHaveLength(31);
    expect(pivot.map((r) => r.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('defaults to Pengunjung + Penjualan (Pesanan Dibuat), matching the real day-1 ground truth (1935 / Rp25.297.000)', () => {
    const pivot = buildDailyTrendPivot(rows, rows);
    const day1 = pivot[0];
    expect(day1.metrics).toHaveLength(2);
    expect(day1.metrics[0]).toMatchObject({ id: 'pengunjung', old: 1935, cur: 1935 });
    expect(day1.metrics[1]).toMatchObject({ id: 'penjualanDibuat', old: 25297000, cur: 25297000 });
  });

  it('is sorted by day-of-month regardless of the raw rows\' order', () => {
    const shuffled = [...rows].reverse();
    const pivot = buildDailyTrendPivot(shuffled, shuffled);
    expect(pivot[0].day).toBe(1);
    expect(pivot[pivot.length - 1].day).toBe(31);
  });

  it('supports picking a different/additional builtin metric (Halaman Dilihat)', () => {
    const sel: DailyTrendMetricSelection = { kind: 'builtin', key: 'halamanDilihat' };
    const pivot = buildDailyTrendPivot(rows, rows, [sel]);
    expect(pivot[0].metrics[0]).toMatchObject({ id: 'halamanDilihat', old: 5408, cur: 5408 });
  });

  it('supports a custom formula metric', () => {
    const sel: DailyTrendMetricSelection = { kind: 'formula', id: 'c1', label: 'Penjualan per Pengunjung', formula: 'penjualanDibuat / pengunjung', fmt: 'rp' };
    const pivot = buildDailyTrendPivot(rows, rows, [sel]);
    expect(pivot[0].metrics[0].old).toBeCloseTo(25297000 / 1935, 3);
  });

  it('leaves a day\'s cell null (not 0) when that day only exists in one of the two periods, per the user\'s spec', () => {
    // Synthetic: old has days 1-3, cur has days 2-4 — day 1 should be
    // cur:null, day 4 should be old:null, matching "kosong" not "0".
    const dayRow = (day: string, pengunjung: number) => ({ Tanggal: day, 'Pengunjung Produk (Kunjungan)': String(pengunjung), 'Total Penjualan (Pesanan Dibuat) (IDR)': '1.000' });
    const oldRows = [dayRow('01-07-2026', 10), dayRow('02-07-2026', 20), dayRow('03-07-2026', 30)];
    const curRows = [dayRow('02-07-2026', 21), dayRow('03-07-2026', 31), dayRow('04-07-2026', 41)];
    const pivot = buildDailyTrendPivot(oldRows, curRows);
    expect(pivot.map((r) => r.day)).toEqual([1, 2, 3, 4]);
    const day1 = pivot.find((r) => r.day === 1)!;
    expect(day1.metrics[0].old).toBe(10);
    expect(day1.metrics[0].cur).toBeNull();
    expect(day1.metrics[0].delta).toBe('—');
    const day4 = pivot.find((r) => r.day === 4)!;
    expect(day4.metrics[0].old).toBeNull();
    expect(day4.metrics[0].cur).toBe(41);
    const day2 = pivot.find((r) => r.day === 2)!;
    expect(day2.metrics[0].old).toBe(20);
    expect(day2.metrics[0].cur).toBe(21);
    expect(day2.metrics[0].deltaNum).not.toBeNull();
  });
});
