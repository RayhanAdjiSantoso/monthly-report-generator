import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseShopeeCSV } from '../shopeeAds';
import { categorizeProdukRows, mergeProdukOtomatis, type ProductMasterEntry } from '../shopeeDeepDive';
import { buildKeywordPivot, buildProdukPivot, DEFAULT_KEYWORD_SELECTIONS, metricSelectionFmt, metricSelectionId, metricSelectionLabel, pickDominantProdukMetric, type MetricSelection } from '../shopeeDeepDiveItemPivot';
import type { StandardChannelMetrics } from '../shopeeDeepDivePivot';
import type { SheetRow } from '../types';

const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);
function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURES), 'utf8');
}
function loadProductMaster(): ProductMasterEntry[] {
  const wb = XLSX.read(readFixture('ref-category-prod.csv'), { type: 'string' });
  const rows = XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return rows.map((r) => ({ namaProdukClean: String(r.nama_produk), category: String(r.category), series: String(r.series) }));
}

const BIAYA: MetricSelection = { kind: 'builtin', key: 'biaya' };
const PESANAN: MetricSelection = { kind: 'builtin', key: 'pesanan' };

describe('pickDominantProdukMetric', () => {
  const base: StandardChannelMetrics = { biaya: 100, dilihat: 0, cpm: 0, klik: 0, ctr: 0, cpc: 0, pesanan: 10, cvr: 0, cpp: 10, produkTerjual: 0, itemsPerOrder: 0, penjualan: 1000, aov: 0, aur: 0, roas: 10, pctBudget: 0, pctRevenue: 0 };

  it('picks the metric with the largest absolute %Change among the 5 candidates', () => {
    const cur: StandardChannelMetrics = { ...base, biaya: 110, pesanan: 11, cpp: 10, penjualan: 1000, roas: 50 }; // roas +400%, biggest by far
    expect(pickDominantProdukMetric(base, cur)).toBe('roas');
  });

  it('picks Biaya when only spend moved', () => {
    const cur: StandardChannelMetrics = { ...base, biaya: 500 }; // +400%, everything else unchanged
    expect(pickDominantProdukMetric(base, cur)).toBe('biaya');
  });
});

describe('metric selection helpers', () => {
  it('resolves id/label/fmt for a builtin selection', () => {
    expect(metricSelectionId(BIAYA)).toBe('biaya');
    expect(metricSelectionLabel(BIAYA)).toBe('Biaya');
    expect(metricSelectionFmt(BIAYA)).toBe('rp');
  });

  it('resolves id/label/fmt for a custom formula selection', () => {
    const custom: MetricSelection = { kind: 'formula', id: 'custom-1', label: 'Biaya per Produk Terjual', formula: 'biaya / produkTerjual', fmt: 'rp' };
    expect(metricSelectionId(custom)).toBe('custom-1');
    expect(metricSelectionLabel(custom)).toBe('Biaya per Produk Terjual');
    expect(metricSelectionFmt(custom)).toBe('rp');
  });
});

describe('buildProdukPivot — real merged "Iklan Produk" dataset', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv')).rows;
  const merged = mergeProdukOtomatis(produk, otomatis);
  const master = loadProductMaster();
  const categorized = categorizeProdukRows(merged, 'Nama Iklan', master).rows;

  it('groups ad launches of the same product from both Iklan Produk and Iklan Produk Otomatis under one clean name and sums their Biaya', () => {
    // Ground truth summed independently across BOTH source files: the manual
    // "[3]" (328668) and "[4]" (633100) launches from Iklan Produk, plus a
    // same-product row contributed by the automatic-targeting campaign
    // (35550) once merged in Step 3 = 997318.
    const rows = buildProdukPivot(categorized, categorized, [BIAYA], 0, 0);
    const row = rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb');
    expect(row).toBeDefined();
    expect(row!.metrics[0].old).toBe(997318);
    expect(row!.metrics[0].cur).toBe(997318);
  });

  it('attaches the category/series resolved from product_master, not "Uncategorized", for a matched product', () => {
    const rows = buildProdukPivot(categorized, categorized, [BIAYA], 0, 0);
    const row = rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb');
    expect(row!.category).toBe('Naked in Bubbles');
    expect(row!.series).toBe('Lavender Series');
  });

  it('sorts rows by |%Change| of the first selected metric descending', () => {
    const oldRows = categorized;
    // Scale down "cur" spend for the same dataset by editing one row's Biaya, to create a real, distinct delta to sort on.
    const curRows = categorized.map((r) => (r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb' ? { ...r, row: { ...r.row, Biaya: '9999999' } } : r));
    const rows = buildProdukPivot(oldRows, curRows, [BIAYA], 0, 0);
    const sortedAbsDeltas = rows.map((r) => Math.abs(r.metrics[0].deltaNum ?? 0));
    for (let i = 1; i < sortedAbsDeltas.length; i++) {
      expect(sortedAbsDeltas[i]).toBeLessThanOrEqual(sortedAbsDeltas[i - 1]);
    }
    expect(rows[0].cleanName).toBe('Maiimi x HMNS: Darker Shade of Orgsm Bomb');
  });

  it('switches to a different builtin metric when selection changes (Pesanan instead of Biaya)', () => {
    const rowsBiaya = buildProdukPivot(categorized, categorized, [BIAYA], 0, 0);
    const rowsPesanan = buildProdukPivot(categorized, categorized, [PESANAN], 0, 0);
    const nameBiaya = rowsBiaya.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb')!;
    const namePesanan = rowsPesanan.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb')!;
    expect(nameBiaya.metrics[0].old).toBe(997318); // Rupiah figure
    expect(namePesanan.metrics[0].old).not.toBe(997318); // order-count figure, genuinely different
  });

  it('supports multiple metric columns at once, like the keyword pivot', () => {
    const rows = buildProdukPivot(categorized, categorized, [BIAYA, PESANAN], 0, 0);
    const row = rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb')!;
    expect(row.metrics).toHaveLength(2);
    expect(row.metrics[0].id).toBe('biaya');
    expect(row.metrics[0].old).toBe(997318);
    expect(row.metrics[1].id).toBe('pesanan');
    expect(row.metrics[1].old).not.toBe(997318);
  });

  it('computes a custom formula metric (Biaya per Pesanan) per product group', () => {
    const custom: MetricSelection = { kind: 'formula', id: 'c1', label: 'Biaya/Pesanan custom', formula: 'biaya / pesanan', fmt: 'rp' };
    const rows = buildProdukPivot(categorized, categorized, [custom], 0, 0);
    const row = rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb')!;
    // ground truth: biaya=997318, pesanan (Konversi) summed across the same 3 rows
    const konvSum = merged.filter((r) => String(r['Nama Iklan']).replace(/\s*\[\d+\]\s*$/, '').trim() === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb').reduce((s, r) => s + Number(String(r['Konversi']).replace(/,/g, '') || 0), 0);
    expect(row.metrics[0].old).toBeCloseTo(997318 / konvSum, 5);
  });

  it('computes Kontribusi Iklan (Penjualan / Total Omzet Toko) when omzet is provided', () => {
    const kontribusi: MetricSelection = { kind: 'builtin', key: 'kontribusi' };
    const rows = buildProdukPivot(categorized, categorized, [kontribusi], 100_000_000, 100_000_000);
    const row = rows.find((r) => r.cleanName === 'Maiimi x HMNS: Darker Shade of Orgsm Bomb')!;
    expect(row.metrics[0].old).toBeGreaterThan(0);
    expect(row.metrics[0].old).toBeLessThan(100); // a single product's share of total store omzet is a small percentage
  });
});

describe('buildKeywordPivot — real "Iklan Toko - Keyword" dataset', () => {
  const kw = parseShopeeCSV(readFixture('iklan-toko-keyword.csv')).rows;

  it('defaults to Biaya/Pesanan/CPP and matches the raw row\'s own values', () => {
    const rows = buildKeywordPivot(kw, kw);
    const row = rows.find((r) => r.namaIklan === 'Gentle Shampoo | 230625' && r.kataPencarian === 'shampo untuk rambut rontok');
    expect(row).toBeDefined();
    expect(row!.metrics.map((m) => m.id)).toEqual(DEFAULT_KEYWORD_SELECTIONS.map((s) => (s.kind === 'builtin' ? s.key : s.id)));
    const biaya = row!.metrics.find((m) => m.id === 'biaya')!;
    const pesanan = row!.metrics.find((m) => m.id === 'pesanan')!;
    const cpp = row!.metrics.find((m) => m.id === 'cpp')!;
    expect(biaya.old).toBe(1825534);
    expect(pesanan.old).toBe(101);
    expect(cpp.old).toBeCloseTo(1825534 / 101, 5);
  });

  it('computes a real %Change when old and cur differ', () => {
    const curScaled = kw.map((r) => (r['Nama Iklan'] === 'Gentle Shampoo | 230625' && r['Kata Pencarian'] === 'shampo untuk rambut rontok' ? { ...r, Biaya: '3651068' } : r)); // 2x
    const rows = buildKeywordPivot(kw, curScaled);
    const row = rows.find((r) => r.namaIklan === 'Gentle Shampoo | 230625' && r.kataPencarian === 'shampo untuk rambut rontok');
    expect(row!.metrics.find((m) => m.id === 'biaya')!.deltaNum).toBeCloseTo(100, 1); // +100%
  });

  it('sorts by |%Change| of the first selected metric descending', () => {
    const curScaled = kw.map((r) => (r['Nama Iklan'] === 'Gentle Shampoo | 230625' && r['Kata Pencarian'] === 'shampo untuk rambut rontok' ? { ...r, Biaya: '999999999' } : r));
    const rows = buildKeywordPivot(kw, curScaled);
    expect(rows[0].namaIklan).toBe('Gentle Shampoo | 230625');
    expect(rows[0].kataPencarian).toBe('shampo untuk rambut rontok');
  });

  it('never drops a (nama iklan, kata pencarian) pair present in only one of the two periods', () => {
    const oldSubset = kw.slice(0, 5);
    const curSubset = kw.slice(5, 10);
    const rows = buildKeywordPivot(oldSubset, curSubset);
    const oldKeys = new Set(oldSubset.map((r) => r['Nama Iklan'] + ' ' + r['Kata Pencarian']));
    const curKeys = new Set(curSubset.map((r) => r['Nama Iklan'] + ' ' + r['Kata Pencarian']));
    const unionSize = new Set([...oldKeys, ...curKeys]).size;
    expect(rows).toHaveLength(unionSize);
  });

  it('accepts a custom selection list, e.g. just a single custom formula column', () => {
    const custom: MetricSelection = { kind: 'formula', id: 'ratio1', label: 'Biaya per Klik', formula: 'biaya / klik', fmt: 'rp' };
    const rows = buildKeywordPivot(kw, kw, [custom]);
    const row = rows.find((r) => r.namaIklan === 'Gentle Shampoo | 230625' && r.kataPencarian === 'shampo untuk rambut rontok')!;
    expect(row.metrics).toHaveLength(1);
    expect(row.metrics[0].id).toBe('ratio1');
    expect(row.metrics[0].label).toBe('Biaya per Klik');
  });
});
