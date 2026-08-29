import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseShopeeCSV } from '../shopeeAds';
import { mergeProdukOtomatis } from '../shopeeDeepDive';
import {
  addFunnelChannelSums,
  buildFunnelTree,
  buildFunnelValues,
  FUNNEL_TREE_DEFS,
  funnelMetrics,
  sumFunnelChannel,
} from '../shopeeFunnel';

const FIXTURES = new URL('./fixtures/shopee-deepdive/', import.meta.url);
function csv(name: string) {
  return parseShopeeCSV(readFileSync(fileURLToPath(new URL(name, FIXTURES)), 'utf8')).rows;
}

// Merged "Iklan Produk" (+ Otomatis) and "Iklan Toko" for both fixture
// periods (bulan 6 = old, bulan 7 = cur).
const produkCur = mergeProdukOtomatis(csv('iklan-produk.csv'), csv('iklan-produk-otomatis.csv'));
const produkOld = mergeProdukOtomatis(csv('iklan-produk-jun.csv'), csv('iklan-produk-otomatis-jun.csv'));
const tokoCur = csv('iklan-toko.csv');
const tokoOld = csv('iklan-toko-jun.csv');

describe('sumFunnelChannel + addFunnelChannelSums — real fixtures', () => {
  it('sums the combined (Produk + Toko) raw columns for the current period', () => {
    const s = addFunnelChannelSums(sumFunnelChannel(produkCur), sumFunnelChannel(tokoCur));
    // Ground truth counted independently from the two fixture files.
    expect(s).toEqual({
      impressions: 1499964,
      clicks: 49679,
      addToCart: 2256,
      purchases: 2951,
      itemsSold: 3200,
      gmv: 403145295,
      spend: 53974608,
    });
  });

  it('sums the combined raw columns for the old period', () => {
    const s = addFunnelChannelSums(sumFunnelChannel(produkOld), sumFunnelChannel(tokoOld));
    expect(s).toMatchObject({ impressions: 1274950, clicks: 41857, addToCart: 2658, purchases: 3362, itemsSold: 3594, gmv: 437706678, spend: 53749248 });
  });

  it('Iklan Toko contributes no Add to Cart (its export has no such column)', () => {
    expect(sumFunnelChannel(tokoCur).addToCart).toBe(0);
    expect(sumFunnelChannel(tokoOld).addToCart).toBe(0);
  });
});

describe('funnelMetrics — ratio-of-sums, matching the reference workbook', () => {
  const s = addFunnelChannelSums(sumFunnelChannel(produkCur), sumFunnelChannel(tokoCur));
  const m = funnelMetrics(s, 1_000_000_000);

  it('derives the funnel rates from the combined sums', () => {
    expect(m.ctr).toBeCloseTo((49679 / 1499964) * 100, 6);
    expect(m.cvr).toBeCloseTo((2951 / 49679) * 100, 6);
    expect(m.cpm).toBeCloseTo((53974608 / 1499964) * 1000, 4);
    expect(m.aov).toBeCloseTo(403145295 / 2951, 4);
    expect(m.abs).toBeCloseTo(3200 / 2951, 6);
    expect(m.aur).toBeCloseTo(403145295 / 3200, 4);
    expect(m.clicksToAtcRate).toBeCloseTo((2256 / 49679) * 100, 6);
  });

  it('keeps ATC → Purchase Rate as a raw ratio even when it exceeds 100% (ATC only from Iklan Produk)', () => {
    // purchases (2951) > addToCart (2256) -> ~130.8%. Not clamped.
    expect(m.atcToPurchaseRate).toBeCloseTo((2951 / 2256) * 100, 6);
    expect(m.atcToPurchaseRate).toBeGreaterThan(100);
  });

  it('GMV (Overall) / Kontribusi Iklan use the manually-entered store GMV', () => {
    expect(m.gmvOverall).toBe(1_000_000_000);
    expect(m.adContribution).toBeCloseTo((403145295 / 1_000_000_000) * 100, 6);
  });

  it('guards every divide-by-zero (empty dataset -> all zeros, no NaN)', () => {
    const z = funnelMetrics(sumFunnelChannel([]), 0);
    for (const v of Object.values(z)) expect(Number.isNaN(v)).toBe(false);
    expect(z.cvr).toBe(0);
    expect(z.atcToPurchaseRate).toBe(0);
  });
});

describe('edge case — account with ONLY Iklan Produk (no Iklan Toko uploaded)', () => {
  it('builds the full funnel with Toko treated as empty, never throwing', () => {
    const s = addFunnelChannelSums(sumFunnelChannel(produkCur), sumFunnelChannel([]));
    expect(s).toEqual(sumFunnelChannel(produkCur));
    const m = funnelMetrics(s, 500_000_000);
    const tree = buildFunnelTree(funnelMetrics(addFunnelChannelSums(sumFunnelChannel(produkOld), sumFunnelChannel([])), 400_000_000), m);
    expect(tree).toHaveLength(13);
    expect(tree.every((r) => Number.isFinite(r.oldNum) && Number.isFinite(r.curNum))).toBe(true);
  });
});

describe('buildFunnelValues / buildFunnelTree', () => {
  const mOld = funnelMetrics(addFunnelChannelSums(sumFunnelChannel(produkOld), sumFunnelChannel(tokoOld)), 900_000_000);
  const mCur = funnelMetrics(addFunnelChannelSums(sumFunnelChannel(produkCur), sumFunnelChannel(tokoCur)), 1_000_000_000);

  it('Values panel lists all 21 metrics with a signed %Change string', () => {
    const rows = buildFunnelValues(mOld, mCur);
    expect(rows).toHaveLength(21);
    const gmv = rows.find((r) => r.key === 'gmvAds')!;
    // gmv fell 437.7M -> 403.1M
    expect(gmv.deltaNum).toBeLessThan(0);
    expect(gmv.cls).toBe('delta-bad');
    expect(gmv.delta).toMatch(/^-/);
  });

  it('Symptom tree has the 13 canonical nodes in reference order with tree-line prefixes', () => {
    const rows = buildFunnelTree(mOld, mCur);
    expect(rows.map((r) => r.label)).toEqual(FUNNEL_TREE_DEFS.map((d) => d.label));
    expect(rows[0].prefix).toBe(''); // GMV is the root
    expect(rows.find((r) => r.label === 'ATC → Purchase Rate')!.prefix).toBe('│     └─ ');
    expect(rows.find((r) => r.label === 'Average Unit Retail')!.prefix).toBe('   └─ ');
  });

  it('tree %Change sign is direction-aware (Spending is neutral, CPM is lower-better)', () => {
    const rows = buildFunnelTree(mOld, mCur);
    expect(rows.find((r) => r.label === 'Spending')!.cls).toBe('delta-neutral');
  });
});
