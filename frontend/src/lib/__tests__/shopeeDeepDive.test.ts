import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { detectShopeeHeaderRow, parseShopeeCSV } from '../shopeeAds';
import { categorizeProdukRows, cleanAdName, matchProductMaster, mergeProdukOtomatis, mergeProductMaster, parseProductMasterRows, UNCATEGORIZED, type ProductMasterEntry } from '../shopeeDeepDive';
import type { SheetRow } from '../types';

// Fixtures are real exports from the "Maiimi" Shopee store (see
// data/shopee-data-fin/ in the repo root) — kept here so a future change to
// Shopee's export format has a fast, concrete regression signal instead of
// silently breaking the parser.
const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);

function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURES), 'utf8');
}

function loadProductMaster(): ProductMasterEntry[] {
  const wb = XLSX.read(readFixture('ref-category-prod.csv'), { type: 'string' });
  const rows = XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return rows.map((r) => ({ namaProdukClean: String(r.nama_produk), category: String(r.category), series: String(r.series) }));
}

describe('cleanAdName', () => {
  it('strips a trailing "[n]" counter suffix Shopee appends on re-launched ads', () => {
    expect(cleanAdName('Maiimi x HMNS: Darker Shade of Orgsm Bomb [3]')).toBe('Maiimi x HMNS: Darker Shade of Orgsm Bomb');
    expect(cleanAdName('Maiimi - Midnight Lavender Bath Bomb [6]')).toBe('Maiimi - Midnight Lavender Bath Bomb');
  });

  it('leaves a name with no suffix untouched', () => {
    expect(cleanAdName('Maiimi - Rose Champagne Bath Bomb')).toBe('Maiimi - Rose Champagne Bath Bomb');
  });

  it('does not strip a bracketed number that is not at the very end', () => {
    expect(cleanAdName('Maiimi x HMNS: "O" Bath Bomb | Bath Bomb | Bola Mandi [2]')).toBe('Maiimi x HMNS: "O" Bath Bomb | Bath Bomb | Bola Mandi');
  });

  it('collapses extra whitespace and trims', () => {
    expect(cleanAdName('  Produk   Dengan   Spasi  [2]  ')).toBe('Produk Dengan Spasi');
  });

  it('handles null/undefined defensively', () => {
    expect(cleanAdName(null)).toBe('');
    expect(cleanAdName(undefined)).toBe('');
  });
});

describe('matchProductMaster', () => {
  const master = loadProductMaster();

  it('matches a known product from the real reference sheet', () => {
    const match = matchProductMaster('Maiimi x HMNS: Darker Shade of Orgsm Bomb', master);
    expect(match).toEqual({ category: 'Naked in Bubbles', series: 'Lavender Series' });
  });

  it('matches case-insensitively', () => {
    const match = matchProductMaster('MAIIMI X HMNS: darker shade of orgsm bomb', master);
    expect(match).not.toBeNull();
  });

  it('returns null for a product not in the reference sheet', () => {
    expect(matchProductMaster('Produk Yang Tidak Pernah Ada', master)).toBeNull();
  });

  it('returns null for an empty name', () => {
    expect(matchProductMaster('', master)).toBeNull();
  });
});

describe('mergeProdukOtomatis — real "Iklan Produk.csv" + "Iklan Produk Otomatis.csv"', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv'));
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv'));
  const merged = mergeProdukOtomatis(produk.rows, otomatis.rows);

  it('removes every row named exactly "Iklan Produk Otomatis" (the subtotal, present in both source files)', () => {
    const subtotalRows = merged.filter((r) => cleanAdName(r['Nama Iklan']).toLowerCase() === 'iklan produk otomatis');
    expect(subtotalRows).toHaveLength(0);
  });

  it('keeps every individual-product row from both files (row counts minus each file\'s own subtotal row)', () => {
    expect(merged).toHaveLength(produk.rows.length - 1 + (otomatis.rows.length - 1));
  });

  it('carries Iklan Produk Otomatis rows under the shared "Nama Iklan" field, sourced from their own "Nama Produk" column', () => {
    const bundleRow = merged.find((r) => String(r['Nama Iklan']).includes('Bundle Mom & Kids Bath Bomb'));
    expect(bundleRow).toBeDefined();
    expect(bundleRow!['Kode Produk']).toBe(55156973172);
  });

  it('does not lose any genuine "Iklan Produk" row that happens to have Nama Iklan populated', () => {
    const testingRow = merged.find((r) => r['Nama Iklan'] === 'Testing | Mix product | 051025');
    expect(testingRow).toBeDefined();
  });
});

describe('categorizeProdukRows — end to end on the merged dataset', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv'));
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv'));
  const merged = mergeProdukOtomatis(produk.rows, otomatis.rows);
  const master = loadProductMaster();
  const result = categorizeProdukRows(merged, 'Nama Iklan', master);

  it('tags a matched row with its real category/series instead of "Uncategorized"', () => {
    const hit = result.rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb');
    expect(hit).toBeDefined();
    expect(hit!.category).toBe('Naked in Bubbles');
    expect(hit!.series).toBe('Lavender Series');
  });

  it('tags an unmatched row as "Uncategorized" instead of dropping it', () => {
    const uncategorizedRows = result.rows.filter((r) => r.category === UNCATEGORIZED);
    expect(uncategorizedRows.length).toBeGreaterThan(0);
    // every uncategorized row must still be present with its original data intact
    for (const r of uncategorizedRows) {
      expect(r.row['Nama Iklan']).toBeDefined();
    }
  });

  it('surfaces the distinct list of unmatched product names for the completion UI', () => {
    expect(result.uncategorized.length).toBeGreaterThan(0);
    expect(new Set(result.uncategorized).size).toBe(result.uncategorized.length); // distinct
  });

  it('never silently drops a row — categorized count equals input row count', () => {
    expect(result.rows).toHaveLength(merged.length);
  });
});

describe('detectShopeeHeaderRow — new Fase 3 channel files', () => {
  it.each(['iklan-produk-otomatis.csv', 'iklan-toko.csv', 'iklan-toko-keyword.csv', 'iklan-live.csv'])('finds the real "Urutan" header row in %s', (name) => {
    const text = readFixture(name);
    const row = detectShopeeHeaderRow(text);
    expect(text.split('\n')[row].toLowerCase()).toContain('urutan');
  });
});

describe('parseShopeeCSV — new Fase 3 channel files parse with their real columns', () => {
  it('Iklan Produk Otomatis: keyed by "Nama Produk", includes Kode Produk', () => {
    const { rows } = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv'));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toContain('Nama Produk');
    expect(Object.keys(rows[0])).toContain('Kode Produk');
  });

  it('Iklan Toko - Keyword: includes both "Kata Pencarian" and "Tipe Pencocokan"', () => {
    const { rows } = parseShopeeCSV(readFixture('iklan-toko-keyword.csv'));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toContain('Kata Pencarian');
    expect(Object.keys(rows[0])).toContain('Tipe Pencocokan');
  });

  it('Iklan Live: has Penonton/Modal instead of Dilihat/Jumlah Klik (Live has no impression/click concept)', () => {
    const { rows } = parseShopeeCSV(readFixture('iklan-live.csv'));
    expect(rows.length).toBeGreaterThan(0);
    expect(Object.keys(rows[0])).toContain('Penonton');
    expect(Object.keys(rows[0])).not.toContain('Dilihat');
  });

  it('every new channel file exposes a parseable "Periode" range matching the real Jul 2026 export', () => {
    for (const name of ['iklan-produk-otomatis.csv', 'iklan-toko.csv', 'iklan-toko-keyword.csv', 'iklan-live.csv']) {
      const { period } = parseShopeeCSV(readFixture(name));
      expect(period.days).toBe(31);
    }
  });
});

describe('Iklan Toko - Keyword is a breakdown of Iklan Toko, not additive spend', () => {
  it('keyword-level Biaya for a campaign sums back to that campaign\'s own Biaya (within rounding)', () => {
    const toko = parseShopeeCSV(readFixture('iklan-toko.csv')).rows;
    const kw = parseShopeeCSV(readFixture('iklan-toko-keyword.csv')).rows;
    const campaignName = 'Gentle Shampoo | 230625';
    const campaignBiaya = Number(toko.find((r) => r['Nama Iklan'] === campaignName)!['Biaya']);
    const kwSum = kw.filter((r) => r['Nama Iklan'] === campaignName).reduce((s, r) => s + Number(r['Biaya']), 0);
    expect(Math.abs(campaignBiaya - kwSum)).toBeLessThanOrEqual(1);
  });
});

describe('parseProductMasterRows — optional uploaded category reference', () => {
  it('reads the canonical nama_produk/category/series columns', () => {
    const rows: SheetRow[] = [
      { nama_produk: 'Maiimi - Rose Champagne Bath Bomb', category: 'Bath Bomb', series: 'Rose Series' },
      { nama_produk: 'Naked Bath Salt: Goodbye Odor', category: 'Naked Bath Salt', series: '' },
    ];
    const parsed = parseProductMasterRows(rows);
    expect(parsed.nameColumn).toBe('nama_produk');
    expect(parsed.categoryColumn).toBe('category');
    expect(parsed.entries).toEqual([
      { namaProdukClean: 'Maiimi - Rose Champagne Bath Bomb', category: 'Bath Bomb', series: 'Rose Series' },
      // series falls back to the category when the sheet leaves it blank
      { namaProdukClean: 'Naked Bath Salt: Goodbye Odor', category: 'Naked Bath Salt', series: 'Naked Bath Salt' },
    ]);
  });

  it('matches loose Indonesian header names, any casing/order, and strips the [n] suffix', () => {
    const rows: SheetRow[] = [{ Kategori: 'Giftset', 'Nama Produk': 'Maiimi - Wine & Wander Bath Bomb [3]', Seri: 'Giftset' }];
    const parsed = parseProductMasterRows(rows);
    expect(parsed.entries).toEqual([{ namaProdukClean: 'Maiimi - Wine & Wander Bath Bomb', category: 'Giftset', series: 'Giftset' }]);
  });

  it('skips rows with a blank name or blank category, last duplicate wins', () => {
    const rows: SheetRow[] = [
      { nama_produk: '', category: 'X', series: '' },
      { nama_produk: 'Produk A', category: '', series: '' },
      { nama_produk: 'Produk B', category: 'First', series: '' },
      { nama_produk: 'produk b', category: 'Second', series: '' },
    ];
    expect(parseProductMasterRows(rows).entries).toEqual([{ namaProdukClean: 'produk b', category: 'Second', series: 'Second' }]);
  });

  it('reports which columns were missing when it cannot build any entries', () => {
    const parsed = parseProductMasterRows([{ foo: 'bar', category: 'X' }]);
    expect(parsed.entries).toEqual([]);
    expect(parsed.nameColumn).toBeNull();
    expect(parsed.categoryColumn).toBe('category');
  });
});

describe('mergeProductMaster — uploaded reference overlays the stored mapping', () => {
  const base: ProductMasterEntry[] = [
    { namaProdukClean: 'Produk A', category: 'Old A', series: 'S1' },
    { namaProdukClean: 'Produk B', category: 'B', series: 'S2' },
  ];
  it('keeps base entries and lets same-name overlay entries win (case-insensitive)', () => {
    const merged = mergeProductMaster(base, [{ namaProdukClean: 'produk a', category: 'New A', series: 'S9' }]);
    expect(merged).toEqual([
      { namaProdukClean: 'produk a', category: 'New A', series: 'S9' },
      { namaProdukClean: 'Produk B', category: 'B', series: 'S2' },
    ]);
  });
  it('returns the base untouched when there is no overlay', () => {
    expect(mergeProductMaster(base, [])).toBe(base);
  });
});
