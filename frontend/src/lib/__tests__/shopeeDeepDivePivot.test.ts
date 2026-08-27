import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseShopeeCSV } from '../shopeeAds';
import { mergeProdukOtomatis } from '../shopeeDeepDive';
import { buildPivotRows, calcLiveChannelMetrics, calcStandardChannelMetrics, CHANNEL_METRIC_DEFS, combineOverallMetrics, detectDominantChannel, LIVE_METRIC_DEFS, OVERALL_METRIC_DEFS, withChannelShare, type LiveChannelMetrics, type StandardChannelMetrics } from '../shopeeDeepDivePivot';

const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);
function readFixture(name: string): string {
  return readFileSync(new URL(name, FIXTURES), 'utf8');
}

describe('calcStandardChannelMetrics — real "Iklan Produk" merged dataset', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv')).rows;
  const merged = mergeProdukOtomatis(produk, otomatis);
  const m = calcStandardChannelMetrics(merged);

  // Ground truth: matches the user's own independently-computed "Iklan
  // Produk 1-31 Jul26" reference table exactly.
  const BIAYA = 45767376;
  const DILIHAT = 1240623;
  const KLIK = 42618;
  const PESANAN = 2346;
  const PRODUK_TERJUAL = 2570;
  const PENJUALAN = 321137889;

  it('sums the raw metric columns correctly', () => {
    expect(m.biaya).toBe(BIAYA);
    expect(m.dilihat).toBe(DILIHAT);
    expect(m.klik).toBe(KLIK);
    expect(m.pesanan).toBe(PESANAN);
    expect(m.produkTerjual).toBe(PRODUK_TERJUAL);
    expect(m.penjualan).toBe(PENJUALAN);
  });

  it('derives CPM/CTR/CPC/CVR/CPP/AOV/ROAS from the raw sums', () => {
    expect(m.cpm).toBeCloseTo((BIAYA / DILIHAT) * 1000, 5);
    expect(m.ctr).toBeCloseTo((KLIK / DILIHAT) * 100, 5);
    expect(m.cpc).toBeCloseTo(BIAYA / KLIK, 5);
    expect(m.cvr).toBeCloseTo((PESANAN / KLIK) * 100, 5);
    expect(m.cpp).toBeCloseTo(BIAYA / PESANAN, 5);
    expect(m.aov).toBeCloseTo(PENJUALAN / PESANAN, 5);
    expect(m.roas).toBeCloseTo(PENJUALAN / BIAYA, 5);
  });

  it('derives Items/Order (Produk Terjual / Pesanan) and AUR (Penjualan / Produk Terjual), matching the user\'s reference (1.10 / Rp124,956)', () => {
    expect(m.itemsPerOrder).toBeCloseTo(1.0955, 3);
    expect(m.aur).toBeCloseTo(124956.4, 0);
  });
});

describe('calcStandardChannelMetrics — real "Iklan Toko" dataset', () => {
  const toko = parseShopeeCSV(readFixture('iklan-toko.csv')).rows;
  const m = calcStandardChannelMetrics(toko);

  it('matches the independently-summed ground truth', () => {
    expect(m.biaya).toBe(8207232);
    expect(m.dilihat).toBe(259341);
    expect(m.klik).toBe(7061);
    expect(m.pesanan).toBe(605);
    expect(m.produkTerjual).toBe(630);
    expect(m.penjualan).toBe(82007406);
  });

  it('derives Items/Order and AUR matching the user\'s reference (1.04 / Rp130,170)', () => {
    expect(m.itemsPerOrder).toBeCloseTo(1.0413, 3);
    expect(m.aur).toBeCloseTo(130170.5, 0);
  });
});

describe('calcLiveChannelMetrics — real "Iklan Live" dataset', () => {
  const live = parseShopeeCSV(readFixture('iklan-live.csv')).rows;
  const m = calcLiveChannelMetrics(live);

  it('uses Penonton/Pesanan/Biaya/Omzet Penjualan, not the Dilihat/Klik columns Live lacks', () => {
    expect(m.biaya).toBe(617362);
    expect(m.penonton).toBe(9536);
    expect(m.pesanan).toBe(36);
    expect(m.penjualan).toBe(7978721);
    expect(m.cpv).toBeCloseTo(617362 / 9536, 5);
    expect(m.cvr).toBeCloseTo((36 / 9536) * 100, 5);
    expect(m.cpp).toBeCloseTo(617362 / 36, 5);
    expect(m.aov).toBeCloseTo(7978721 / 36, 5);
    expect(m.roas).toBeCloseTo(7978721 / 617362, 5);
  });
});

describe('combineOverallMetrics — real Produk + Toko + Live combined (the exact bug the user reported)', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv')).rows;
  const merged = mergeProdukOtomatis(produk, otomatis);
  const toko = parseShopeeCSV(readFixture('iklan-toko.csv')).rows;
  const live = parseShopeeCSV(readFixture('iklan-live.csv')).rows;
  const produkM = calcStandardChannelMetrics(merged);
  const tokoM = calcStandardChannelMetrics(toko);
  const liveM = calcLiveChannelMetrics(live);
  const overall = combineOverallMetrics(produkM, tokoM, liveM);

  it('adds Biaya and Penjualan across all 3 channels (already worked before)', () => {
    expect(overall.biaya).toBe(produkM.biaya + tokoM.biaya + liveM.biaya);
    expect(overall.biaya).toBe(54591970); // matches the user's "Iklan Shopee Overall 1-31 Jul26" reference
    expect(overall.penjualan).toBe(produkM.penjualan + tokoM.penjualan + liveM.penjualan);
    expect(overall.penjualan).toBe(411124016);
  });

  it('adds Iklan Live\'s Penonton into Overall Dilihat (974504 + 300446 + ... this fixture\'s Jul numbers: 1240623 + 259341 + 9536 = 1509500)', () => {
    expect(overall.dilihat).toBe(produkM.dilihat + tokoM.dilihat + liveM.penonton);
    expect(overall.dilihat).toBe(1509500); // matches the user's reference exactly
  });

  it('adds Iklan Live\'s Pesanan into Overall Pesanan (2346 + 605 + 36 = 2987)', () => {
    expect(overall.pesanan).toBe(produkM.pesanan + tokoM.pesanan + liveM.pesanan);
    expect(overall.pesanan).toBe(2987); // matches the user's reference exactly
  });

  it('does NOT add Live into Jumlah Klik or Produk Terjual (Live has neither concept)', () => {
    expect(overall.klik).toBe(produkM.klik + tokoM.klik);
    expect(overall.produkTerjual).toBe(produkM.produkTerjual + tokoM.produkTerjual);
  });

  it('re-derives CPM/CVR/Items-Order/AUR from the corrected Dilihat/Pesanan, matching the user\'s reference (CPM Rp36,166, CVR 6.01%, Items/Order 1.07, AUR Rp128,476)', () => {
    expect(overall.cpm).toBeCloseTo(36166, 0);
    expect(overall.cvr).toBeCloseTo(6.012, 2);
    expect(overall.itemsPerOrder).toBeCloseTo(1.0713, 3);
    expect(overall.aur).toBeCloseTo(128476.3, 0);
  });
});

describe('withChannelShare — %Budget and %Revenue against the real Overall totals', () => {
  const produk = parseShopeeCSV(readFixture('iklan-produk.csv')).rows;
  const otomatis = parseShopeeCSV(readFixture('iklan-produk-otomatis.csv')).rows;
  const merged = mergeProdukOtomatis(produk, otomatis);
  const toko = parseShopeeCSV(readFixture('iklan-toko.csv')).rows;
  const live = parseShopeeCSV(readFixture('iklan-live.csv')).rows;
  const produkM = calcStandardChannelMetrics(merged);
  const tokoM = calcStandardChannelMetrics(toko);
  const liveM = calcLiveChannelMetrics(live);
  const overall = combineOverallMetrics(produkM, tokoM, liveM);
  const produkShared = withChannelShare(produkM, overall.biaya, overall.penjualan);
  const tokoShared = withChannelShare(tokoM, overall.biaya, overall.penjualan);
  const liveShared = withChannelShare(liveM, overall.biaya, overall.penjualan);

  it('computes %Budget (channel Biaya / Overall Biaya) matching the user\'s reference (83.84% / 15.03% / 1.13%)', () => {
    expect(produkShared.pctBudget).toBeCloseTo(83.84, 1);
    expect(tokoShared.pctBudget).toBeCloseTo(15.03, 1);
    expect(liveShared.pctBudget).toBeCloseTo(1.13, 1);
  });

  it('computes %Revenue (channel Penjualan / Overall Penjualan) matching the user\'s reference (78.11% / 19.95% / 1.94%) — this replaces the old "Kontribusi Iklan" definition', () => {
    expect(produkShared.pctRevenue).toBeCloseTo(78.11, 1);
    expect(tokoShared.pctRevenue).toBeCloseTo(19.95, 1);
    expect(liveShared.pctRevenue).toBeCloseTo(1.94, 1);
  });

  it('the 3 channels\' %Budget (and %Revenue) sum to ~100%', () => {
    expect(produkShared.pctBudget + tokoShared.pctBudget + liveShared.pctBudget).toBeCloseTo(100, 0);
    expect(produkShared.pctRevenue + tokoShared.pctRevenue + liveShared.pctRevenue).toBeCloseTo(100, 0);
  });

  it('returns 0 for both shares when the Overall reference is 0 (guards divide-by-zero)', () => {
    const shared = withChannelShare(produkM, 0, 0);
    expect(shared.pctBudget).toBe(0);
    expect(shared.pctRevenue).toBe(0);
  });
});

describe('buildPivotRows', () => {
  const base: StandardChannelMetrics = { biaya: 0, dilihat: 0, cpm: 0, klik: 0, ctr: 0, cpc: 0, pesanan: 0, cvr: 0, cpp: 0, produkTerjual: 0, itemsPerOrder: 0, penjualan: 0, aov: 0, aur: 0, roas: 0, pctBudget: 0, pctRevenue: 0 };
  const mOld: StandardChannelMetrics = { ...base, biaya: 1000, dilihat: 100, cpm: 10, klik: 10, ctr: 10, cpc: 100, pesanan: 5, cvr: 50, cpp: 200, penjualan: 2000, aov: 400, roas: 2, pctRevenue: 20 };
  const mCur: StandardChannelMetrics = { ...base, biaya: 2000, dilihat: 100, cpm: 20, klik: 10, ctr: 10, cpc: 200, pesanan: 10, cvr: 100, cpp: 200, penjualan: 5000, aov: 500, roas: 2.5, pctRevenue: 25 };

  it('builds one row per OVERALL_METRIC_DEFS entry (no %Budget/%Revenue for Overall itself), in def order', () => {
    const rows = buildPivotRows(mOld, mCur, OVERALL_METRIC_DEFS);
    expect(rows).toHaveLength(OVERALL_METRIC_DEFS.length);
    expect(rows.some((r) => r.key === 'pctBudget')).toBe(false);
    expect(rows[0]).toMatchObject({ key: 'biaya', label: 'Biaya', old: 'Rp1.000', cur: 'Rp2.000', deltaNum: 100 });
  });

  it('CHANNEL_METRIC_DEFS appends %Budget and %Revenue after everything OVERALL_METRIC_DEFS has', () => {
    const rows = buildPivotRows(mOld, mCur, CHANNEL_METRIC_DEFS);
    expect(rows).toHaveLength(OVERALL_METRIC_DEFS.length + 2);
    expect(rows.at(-2)!.key).toBe('pctBudget');
    expect(rows.at(-1)!.key).toBe('pctRevenue');
    expect(rows.at(-1)!.old).toBe('20,00%'); // Indonesian numeral convention: comma decimal
  });

  it('formats a % metric with the pct formatter, Indonesian comma-decimal', () => {
    const rows = buildPivotRows(mOld, mCur, OVERALL_METRIC_DEFS);
    const ctrRow = rows.find((r) => r.key === 'ctr')!;
    expect(ctrRow.old).toBe('10,00%');
  });

  it('formats a ROAS metric with the x suffix, Indonesian comma-decimal', () => {
    const rows = buildPivotRows(mOld, mCur, OVERALL_METRIC_DEFS);
    const roasRow = rows.find((r) => r.key === 'roas')!;
    expect(roasRow.cur).toBe('2,50x');
  });
});

describe('LIVE_METRIC_DEFS pivot', () => {
  it('builds rows using Live\'s own shape (Penonton/CPV instead of Dilihat/CPM) plus %Budget/%Revenue', () => {
    const mOld: LiveChannelMetrics = { biaya: 100, penonton: 10, cpv: 10, pesanan: 1, cvr: 10, cpp: 100, penjualan: 500, aov: 500, roas: 5, pctBudget: 5, pctRevenue: 5 };
    const mCur: LiveChannelMetrics = { biaya: 200, penonton: 20, cpv: 10, pesanan: 3, cvr: 15, cpp: 66.67, penjualan: 1500, aov: 500, roas: 7.5, pctBudget: 10, pctRevenue: 15 };
    const rows = buildPivotRows(mOld, mCur, LIVE_METRIC_DEFS);
    expect(rows.map((r) => r.key)).toEqual(['biaya', 'penonton', 'cpv', 'pesanan', 'cvr', 'cpp', 'penjualan', 'aov', 'roas', 'pctBudget', 'pctRevenue']);
  });
});

describe('detectDominantChannel', () => {
  const base: StandardChannelMetrics = { biaya: 0, dilihat: 0, cpm: 0, klik: 0, ctr: 0, cpc: 0, pesanan: 0, cvr: 0, cpp: 0, produkTerjual: 0, itemsPerOrder: 0, penjualan: 0, aov: 0, aur: 0, roas: 0, pctBudget: 0, pctRevenue: 0 };

  it('picks Iklan Produk when it wins all 4 signals: bigger budget share, bigger revenue share, and larger %change on both Biaya and Penjualan', () => {
    const produkOld = { ...base, biaya: 9000000, penjualan: 78000000 };
    const produkCur = { ...base, biaya: 10000000, penjualan: 85000000 }; // +11.1% biaya, +9.0% penjualan
    const tokoOld = { ...base, biaya: 800000, penjualan: 12000000 };
    const tokoCur = { ...base, biaya: 850000, penjualan: 12500000 }; // +6.25% biaya, +4.2% penjualan — smaller on every signal
    const result = detectDominantChannel(produkOld, produkCur, tokoOld, tokoCur);
    expect(result).toBe('produk');
  });

  it('picks Iklan Toko when Toko\'s numbers dominate budget share, revenue share, and both magnitudes of change', () => {
    const produkOld = { ...base, biaya: 9000000, penjualan: 78000000 };
    const produkCur = { ...base, biaya: 9000000, penjualan: 78000000 }; // 0% change, and ends up the smaller channel too
    const tokoOld = { ...base, biaya: 100000, penjualan: 1000000 };
    const tokoCur = { ...base, biaya: 20000000, penjualan: 90000000 }; // now bigger budget+revenue share AND huge %change
    const result = detectDominantChannel(produkOld, produkCur, tokoOld, tokoCur);
    expect(result).toBe('toko');
  });

  it('falls back to %Budget share as the tie-breaker on a 2-2 vote', () => {
    // Produk wins budget share + revenue share (2 votes); Toko wins both
    // %Change magnitudes (2 votes) — a genuine 2-2 tie, so %Budget share
    // (won by Produk here) must decide it.
    const produkOld = { ...base, biaya: 1000000, penjualan: 1000000 };
    const produkCur = { ...base, biaya: 1050000, penjualan: 1050000 }; // small %change, but bigger absolute share
    const tokoOld = { ...base, biaya: 10000, penjualan: 10000 };
    const tokoCur = { ...base, biaya: 100000, penjualan: 100000 }; // huge %change, but tiny absolute share
    const result = detectDominantChannel(produkOld, produkCur, tokoOld, tokoCur);
    expect(result).toBe('produk');
  });
});
