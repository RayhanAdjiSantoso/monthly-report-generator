import { describe, expect, it } from 'vitest';
import type { FunnelMetrics } from '../shopeeFunnel';
import { buildSymptomSummary } from '../shopeeFunnelSummary';

// Baseline drawn from a real report (Jul → Ags 2026): GMV up, driven by more
// transactions off a big traffic gain, while conversion rate fell — the
// classic "iklan sudah menyebar, closing yang kurang" pattern.
function metrics(over: Partial<FunnelMetrics>): FunnelMetrics {
  return {
    gmvOverall: 0,
    gmvAds: 0,
    adContribution: 0,
    roas: 0,
    spend: 0,
    impressions: 0,
    cpm: 0,
    clicks: 0,
    ctr: 0,
    cpc: 0,
    addToCart: 0,
    clicksToAtcRate: 0,
    cpAtc: 0,
    purchases: 0,
    atcToPurchaseRate: 0,
    cpp: 0,
    cvr: 0,
    itemsSold: 0,
    aov: 0,
    abs: 0,
    aur: 0,
    ...over,
  };
}

const OLD = metrics({
  gmvAds: 159_247_813,
  roas: 7.21,
  spend: 22_091_443,
  impressions: 647_709,
  cpm: 34_107,
  clicks: 26_324,
  ctr: 4.06,
  clicksToAtcRate: 3.0,
  atcToPurchaseRate: 28.32,
  purchases: 224,
  cpp: 98_623,
  cvr: 0.851,
  aov: 710_927,
});
const CUR = metrics({
  gmvAds: 182_738_844,
  roas: 5.58,
  spend: 32_727_027,
  impressions: 947_191,
  cpm: 34_552,
  clicks: 35_759,
  ctr: 3.78,
  clicksToAtcRate: 3.34,
  atcToPurchaseRate: 21.07,
  purchases: 252,
  cpp: 129_869,
  cvr: 0.705,
  aov: 725_154,
});

describe('buildSymptomSummary', () => {
  it('reads GMV up, driven by transactions, with the traffic-up / conversion-down pattern', () => {
    const s = buildSymptomSummary(OLD, CUR);
    expect(s.gmvDir).toBe('up');
    expect(s.headline).toContain('GMV Ads naik');
    expect(s.headline).toContain('jumlah transaksi');
    // traffic up + CVR down branch
    expect(s.points.some((p) => p.includes('memperluas jangkauan') && p.includes('minat closing'))).toBe(true);
    // leak identified at the keranjang → pembelian stage (−25,6% vs +11,3%)
    expect(s.points.some((p) => p.includes('keranjang → pembelian'))).toBe(true);
    // verdict points at conversion, not media buying
    expect(s.verdict).toContain('Bottleneck ada di konversi akhir');
  });

  it('flags a healthy both-up quarter as "pertumbuhan sehat"', () => {
    const cur = metrics({ ...CUR, cvr: 1.1, atcToPurchaseRate: 34, clicks: 30_000 });
    const s = buildSymptomSummary(OLD, cur);
    expect(s.gmvDir).toBe('up');
    expect(s.verdict).toMatch(/sehat|Pertahankan/);
  });

  it('handles a flat quarter without dividing by zero', () => {
    const s = buildSymptomSummary(OLD, OLD);
    expect(s.gmvDir).toBe('flat');
    expect(s.points.length).toBeGreaterThan(0);
  });
});
