import {
  addFunnelChannelSums,
  buildFunnelTree,
  buildFunnelValues,
  funnelMetrics,
  sumFunnelChannel,
  type FunnelTreeRow,
  type FunnelValueRow,
} from '../../lib/shopeeFunnel';
import { buildSymptomSummary, type SymptomSummary } from '../../lib/shopeeFunnelSummary';
import {
  buildPareto,
  buildProductRankings,
  CONVERSION_METRIC_DEFS,
  parseProductPerfRows,
  TRAFFIC_METRIC_DEFS,
  type ParetoRow,
  type ProductMetricRanking,
} from '../../lib/shopeeProductAnalysis';
import { findShopeeCol, parseShopeeNum } from '../../lib/shopeeAds';
import type { SheetRow } from '../../lib/types';

// ══════════════════════════════════════════════════════
// SHOPEE ADS — assembles the 4 "manual report" sections (Fundamental /
// Pareto / Traffic / Conversion) into one report shape the UI renders.
// Called alongside buildShopeeReport + buildShopeeDeepDiveReport in
// ShopeeTab.generate(). Mirrors the shopeeDeepDiveReport.ts pattern.
// ══════════════════════════════════════════════════════

export interface BuildShopeeFunnelReportInput {
  // Fundamental — Iklan Produk (already merged with Produk Otomatis by the
  // caller) + Iklan Toko, 2 periods. Live is footnote-only.
  produkOld: SheetRow[];
  produkCur: SheetRow[];
  tokoOld: SheetRow[];
  tokoCur: SheetRow[];
  liveOld: SheetRow[];
  liveCur: SheetRow[];
  // Total Omzet Toko (Pesanan Dibuat) — the "GMV (Overall)" node.
  omzetOld: number;
  omzetCur: number;
  // Pareto / Traffic / Conversion — "Produk dengan Performa Terbaik" sheet
  // rows for each period. Old may be null (Pareto still works; Traffic /
  // Conversion fall back to single-period).
  productPerfOld: SheetRow[] | null;
  productPerfCur: SheetRow[] | null;
}

// One ad channel's current-period contribution — feeds the "Kontribusi Antar
// Channel" chart. `roas` is carried for reference only; the chart's
// effectiveness signal is the efficiency index (GMV share ÷ spend share),
// which is robust to a channel with tiny spend catching one big order.
export interface ChannelMixEntry {
  key: 'produk' | 'toko' | 'live';
  label: string;
  color: string;
  spend: number;
  gmv: number;
  roas: number;
}

export interface ShopeeFunnelReport {
  values: FunnelValueRow[];
  tree: FunnelTreeRow[];
  // Plain-language read of the funnel movement (headline + points + verdict).
  symptom: SymptomSummary;
  // Current-period spend/GMV per ad channel (only channels with data).
  channelMix: ChannelMixEntry[];
  // Iklan Live GMV, shown as a footnote outside the funnel tree (Live has no
  // impression/click columns so it can't join the tree, but its revenue
  // shouldn't vanish from view).
  liveGmv: { old: number; cur: number; hasData: boolean };
  pareto: ParetoRow[];
  traffic: ProductMetricRanking[];
  conversion: ProductMetricRanking[];
  hasProductPerfCur: boolean;
  hasProductPerfOld: boolean;
}

function sumLiveGmv(rows: SheetRow[]): number {
  const col = findShopeeCol(rows, 'omzet penjualan');
  if (!col) return 0;
  return rows.reduce((s, r) => s + parseShopeeNum(r[col]), 0);
}

function mixEntry(key: ChannelMixEntry['key'], label: string, color: string, spend: number, gmv: number): ChannelMixEntry {
  return { key, label, color, spend, gmv, roas: spend > 0 ? gmv / spend : 0 };
}

export function buildShopeeFunnelReport(input: BuildShopeeFunnelReportInput): ShopeeFunnelReport {
  const sumsOld = addFunnelChannelSums(sumFunnelChannel(input.produkOld), sumFunnelChannel(input.tokoOld));
  const sumsCur = addFunnelChannelSums(sumFunnelChannel(input.produkCur), sumFunnelChannel(input.tokoCur));
  const mOld = funnelMetrics(sumsOld, input.omzetOld);
  const mCur = funnelMetrics(sumsCur, input.omzetCur);

  const liveOldGmv = sumLiveGmv(input.liveOld);
  const liveCurGmv = sumLiveGmv(input.liveCur);

  const perfOld = input.productPerfOld ? parseProductPerfRows(input.productPerfOld) : [];
  const perfCur = input.productPerfCur ? parseProductPerfRows(input.productPerfCur) : [];

  // Current-period channel mix — Iklan Produk always present; Toko / Live only
  // when the user uploaded that channel. Live GMV uses the same "Omzet
  // Penjualan" column sumLiveGmv reads.
  const produkCurSums = sumFunnelChannel(input.produkCur);
  const channelMix: ChannelMixEntry[] = [mixEntry('produk', 'Iklan Produk', '#ee4d2d', produkCurSums.spend, produkCurSums.gmv)];
  if (input.tokoOld.length || input.tokoCur.length) {
    const t = sumFunnelChannel(input.tokoCur);
    channelMix.push(mixEntry('toko', 'Iklan Toko', '#0d9488', t.spend, t.gmv));
  }
  if (input.liveOld.length || input.liveCur.length) {
    channelMix.push(mixEntry('live', 'Iklan Live', '#7c3aed', sumFunnelChannel(input.liveCur).spend, liveCurGmv));
  }

  return {
    values: buildFunnelValues(mOld, mCur),
    tree: buildFunnelTree(mOld, mCur),
    symptom: buildSymptomSummary(mOld, mCur),
    channelMix: channelMix.filter((e) => e.spend > 0 || e.gmv > 0),
    liveGmv: { old: liveOldGmv, cur: liveCurGmv, hasData: liveOldGmv > 0 || liveCurGmv > 0 },
    pareto: buildPareto(perfCur),
    traffic: buildProductRankings(perfOld, perfCur, TRAFFIC_METRIC_DEFS),
    conversion: buildProductRankings(perfOld, perfCur, CONVERSION_METRIC_DEFS),
    hasProductPerfCur: perfCur.length > 0,
    hasProductPerfOld: perfOld.length > 0,
  };
}
