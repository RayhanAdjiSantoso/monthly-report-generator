import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseShopeeCSV } from '../../../lib/shopeeAds';
import type { ProductMasterEntry } from '../../../lib/shopeeDeepDive';
import type { SheetRow } from '../../../lib/types';
import { buildShopeeDeepDiveReport } from '../shopeeDeepDiveReport';

const FIXTURES = new URL('../../../lib/__tests__/fixtures/shopee-deepdive/', import.meta.url);
function readText(name: string): string {
  return readFileSync(fileURLToPath(new URL(name, FIXTURES)), 'utf8');
}
function readXlsxSheet(file: string, sheetName: string): SheetRow[] {
  const buf = readFileSync(fileURLToPath(new URL(file, FIXTURES)));
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[sheetName], { defval: '' });
}
function loadProductMaster(): ProductMasterEntry[] {
  const wb = XLSX.read(readText('ref-category-prod.csv'), { type: 'string' });
  const rows = XLSX.utils.sheet_to_json<SheetRow>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  return rows.map((r) => ({ namaProdukClean: String(r.nama_produk), category: String(r.category), series: String(r.series) }));
}

// End-to-end smoke test: wires every Fase 3 module together on the real
// "Maiimi" fixture set (only 1 real period exists, so old===cur here — this
// exercises assembly/shape, not %Change math, which each module's own unit
// tests already cover with proper old-vs-cur values).
describe('buildShopeeDeepDiveReport — full pipeline on real fixtures', () => {
  const produk = parseShopeeCSV(readText('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readText('iklan-produk-otomatis.csv')).rows;
  const toko = parseShopeeCSV(readText('iklan-toko.csv')).rows;
  const tokoKeyword = parseShopeeCSV(readText('iklan-toko-keyword.csv')).rows;
  const live = parseShopeeCSV(readText('iklan-live.csv')).rows;
  const productPerformance = readXlsxSheet('product-performance.xlsx', 'Produk dengan Performa Terbaik');
  const tingkatkan = readXlsxSheet('product-performance.xlsx', 'Tingkatkan dengan Iklan');
  const overview = readXlsxSheet('product-overview.xlsx', 'overview');
  const master = loadProductMaster();

  const report = buildShopeeDeepDiveReport({
    produkOld: produk,
    produkCur: produk,
    produkOtomatisOld: otomatis,
    produkOtomatisCur: otomatis,
    tokoOld: toko,
    tokoCur: toko,
    tokoKeywordOld: tokoKeyword,
    tokoKeywordCur: tokoKeyword,
    liveOld: live,
    liveCur: live,
    productPerformanceRows: productPerformance,
    tingkatkanDenganIklanRows: tingkatkan,
    overviewOldRows: overview,
    overviewCurRows: overview,
    productMaster: master,
    omzetOld: 300_000_000,
    omzetCur: 320_000_000,
  });

  it('builds all 4 channel pivots with the right metric-set length (Overall has no %Budget/%Revenue; Produk/Toko/Live do)', () => {
    expect(report.overall).toHaveLength(15); // 13 original + Items/Order + AUR
    expect(report.produk).toHaveLength(17); // + %Budget + %Revenue
    expect(report.toko).toHaveLength(17);
    expect(report.live).toHaveLength(11); // 9 original + %Budget + %Revenue (no Items/Order/AUR — Live has no Produk Terjual)
  });

  it('fixes the reported Overall Dilihat/Pesanan bug: Iklan Live\'s Penonton/Pesanan are now included (1.240.623+259.341+9.536=1.509.500 Dilihat; 2.346+605+36=2.987 Pesanan)', () => {
    const dilihatRow = report.overall.find((r) => r.key === 'dilihat')!;
    const pesananRow = report.overall.find((r) => r.key === 'pesanan')!;
    expect(dilihatRow.oldNum).toBe(1509500);
    expect(pesananRow.oldNum).toBe(2987);
  });

  it('computes % Revenue (renamed from Kontribusi Iklan) as channel Penjualan / Overall Penjualan, matching the user\'s reference (Iklan Produk ~78.11%)', () => {
    const pctRevenueRow = report.produk.find((r) => r.key === 'pctRevenue')!;
    expect(pctRevenueRow.oldNum).toBeCloseTo(78.11, 1);
  });

  it('computes % Budget as channel Biaya / Overall Biaya, matching the user\'s reference (Iklan Produk ~83.84%)', () => {
    const pctBudgetRow = report.produk.find((r) => r.key === 'pctBudget')!;
    expect(pctBudgetRow.oldNum).toBeCloseTo(83.84, 1);
  });

  it('picks a dominant channel between produk and toko', () => {
    expect(['produk', 'toko']).toContain(report.dominantChannel);
  });

  it('builds a non-empty per-produk pivot with category/series attached', () => {
    expect(report.produkPivot.length).toBeGreaterThan(0);
    expect(report.produkPivot.some((r) => r.category !== 'Uncategorized')).toBe(true);
  });

  it('builds a non-empty per-keyword pivot with the default Biaya/Pesanan/CPP metric columns', () => {
    expect(report.keywordPivot.length).toBeGreaterThan(0);
    const ids = report.keywordPivot[0].metrics.map((m) => m.id);
    expect(ids).toEqual(['biaya', 'pesanan', 'cpp']);
  });

  it('surfaces an uncategorized list (some real ad names have no product_master match)', () => {
    expect(report.uncategorized.length).toBeGreaterThan(0);
  });

  it('flags the 5 known unadvertised-but-selling variants', () => {
    expect(report.unadvertisedVariants).toHaveLength(5);
  });

  it('marks hasProductPerformanceData true when a Product Performance file was provided', () => {
    expect(report.hasProductPerformanceData).toBe(true);
  });

  it('reads Tingkatkan dengan Iklan as empty, matching the real file', () => {
    expect(report.tingkatkanDenganIklanRows).toHaveLength(0);
  });

  it('builds a 31-row daily trend pivot (day-aligned, same file for both periods in this fixture) with the default 2 metrics', () => {
    expect(report.dailyTrendPivot).toHaveLength(31);
    expect(report.dailyTrendPivot[0].day).toBe(1);
    expect(report.dailyTrendPivot[0].metrics).toHaveLength(2);
    expect(report.dailyTrendPivot[0].metrics[0].old).not.toBeNull();
    expect(report.dailyTrendPivot[0].metrics[0].cur).not.toBeNull();
  });

  it('handles missing optional inputs (no Product Performance / no Overview) without crashing', () => {
    const minimal = buildShopeeDeepDiveReport({
      produkOld: produk,
      produkCur: produk,
      produkOtomatisOld: [],
      produkOtomatisCur: [],
      tokoOld: toko,
      tokoCur: toko,
      tokoKeywordOld: [],
      tokoKeywordCur: [],
      liveOld: [],
      liveCur: [],
      productPerformanceRows: null,
      tingkatkanDenganIklanRows: null,
      overviewOldRows: null,
      overviewCurRows: null,
      productMaster: master,
      omzetOld: 0,
      omzetCur: 0,
    });
    expect(minimal.unadvertisedVariants).toEqual([]);
    expect(minimal.hasProductPerformanceData).toBe(false);
    expect(minimal.dailyTrendPivot).toEqual([]);
    expect(minimal.keywordPivot).toEqual([]);
  });
});
