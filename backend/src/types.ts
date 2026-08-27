export type Platform = 'meta' | 'shopee' | 'tiktok';
export type PeriodRole = 'old' | 'cur';

export interface ShopeeAdRowInput {
  periodRole: PeriodRole;
  channel: string;
  namaIklanRaw: string | null;
  namaIklanClean: string | null;
  kodeProduk: string | null;
  category: string | null;
  series: string | null;
  kataPencarian: string | null;
  tanggalMulai: string | null;
  tanggalSelesai: string | null;
  dilihat: number | null;
  jumlahKlik: number | null;
  ctr: number | null;
  konversi: number | null;
  konversiLangsung: number | null;
  produkTerjual: number | null;
  terjualLangsung: number | null;
  omzetPenjualan: number | null;
  penjualanLangsung: number | null;
  biaya: number | null;
  roas: number | null;
  acos: number | null;
  extra: Record<string, unknown> | null;
}

export interface MetaAdRowInput {
  periodRole: PeriodRole;
  channel: string;
  campaignName: string | null;
  month: string | null;
  age: string | null;
  gender: string | null;
  amountSpent: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  purchases: number | null;
  purchasesConversionValue: number | null;
  roas: number | null;
  extra: Record<string, unknown> | null;
}

export interface TiktokAdRowInput {
  periodRole: PeriodRole;
  campaignName: string | null;
  cost: number | null;
  skuOrders: number | null;
  grossRevenue: number | null;
  extra: Record<string, unknown> | null;
}

export interface RawFileMeta {
  channel: string;
  periodRole: PeriodRole;
  originalFilename: string | null;
}

export interface SaveReportPeriod {
  oldStart: string | null;
  oldEnd: string | null;
  curStart: string | null;
  curEnd: string | null;
  oldLabel: string | null;
  curLabel: string | null;
}

export interface SaveReportPayload {
  brandId: number;
  platform: Platform;
  period: SaveReportPeriod;
  reportConfig: Record<string, unknown> | null;
  rows: {
    shopee?: ShopeeAdRowInput[];
    meta?: MetaAdRowInput[];
    tiktok?: TiktokAdRowInput[];
  };
}
