import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Dropzone } from '../../components/Dropzone';
import { DownloadPdfButton } from '../../components/DownloadPdfButton';
import { HowTo, HowToStep } from '../../components/HowTo';
import { InlineNotice } from '../../components/InlineNotice';
import { KpiTable } from '../../components/KpiTable';
import { OmzetField } from '../../components/OmzetField';
import { PeriodCompareChip } from '../../components/PeriodCompareChip';
import { PeriodInputRow } from '../../components/PeriodInputRow';
import { PeriodWarningBanner } from '../../components/PeriodWarningBanner';
import { SectionDownloadButton } from '../../components/SectionDownloadButton';
import { StepIndicator, type Step } from '../../components/StepIndicator';
import { usePeriodLabel } from '../../hooks/usePeriodLabel';
import { toISODate } from '../../lib/dateFmt';
import { parseShopeeCSV } from '../../lib/shopeeAds';
import { categorizeProdukRows, mergeProdukOtomatis, type ProductMasterEntry } from '../../lib/shopeeDeepDive';
import { comparePeriodDays } from '../../lib/periodLabel';
import { periodFromOverviewFilename } from '../../lib/shopeeOverview';
import type { SheetRow } from '../../lib/types';
import { requireColumns, validateFileBasics } from '../../lib/validation';
import { readSpreadsheetFile } from '../../lib/xlsxUtils';
import type { PlatformResultData } from '../../lib/summary';
import { SaveStatus } from '../reports/SaveStatus';
import { useAutoSave } from '../reports/useAutoSave';
import { getProductMaster, saveProductMasterEntry } from '../reports/api';
import { mapShopeeRows, type ShopeeCategorization } from '../reports/rowMapping';
import type { MetricSelection } from '../../lib/shopeeDeepDiveItemPivot';
import type { DailyTrendMetricSelection } from '../../lib/shopeeDeepDiveInsights';
import type { RawFileEntry, SaveReportPayload } from '../reports/types';
import { ChannelPivotSection, DailyTrendSection, ItemPivotSection, TingkatkanDenganIklanTable, UnadvertisedVariantsTable, UncategorizedPanel } from './DeepDiveSections';
import { buildShopeeDeepDiveReport, type ShopeeDeepDiveReport } from './shopeeDeepDiveReport';
import { buildShopeeReport, type ShopeeReport } from './shopeeReport';

type AdsFileKey =
  | 'toko-old'
  | 'toko-cur'
  | 'produk-old'
  | 'produk-cur'
  | 'produk-otomatis-old'
  | 'produk-otomatis-cur'
  | 'toko-keyword-old'
  | 'toko-keyword-cur'
  | 'live-old'
  | 'live-cur';
type OverviewFileKey = 'overview-old' | 'overview-cur';

interface AdsFileState {
  rows: SheetRow[];
  fileName: string;
  file: File;
}

interface DateRange {
  start: string | null;
  end: string | null;
}

const EMPTY_RANGE: DateRange = { start: null, end: null };

interface OverviewFileState {
  rows: SheetRow[];
  fileName: string;
  period: string;
}

interface ProductPerformanceFileState {
  mainRows: SheetRow[];
  tingkatkanRows: SheetRow[];
  fileName: string;
  file: File;
}

const EMPTY_ADS_FILES: Record<AdsFileKey, AdsFileState | null> = {
  'toko-old': null,
  'toko-cur': null,
  'produk-old': null,
  'produk-cur': null,
  'produk-otomatis-old': null,
  'produk-otomatis-cur': null,
  'toko-keyword-old': null,
  'toko-keyword-cur': null,
  'live-old': null,
  'live-cur': null,
};

const EMPTY_OVERVIEW_FILES: Record<OverviewFileKey, OverviewFileState | null> = {
  'overview-old': null,
  'overview-cur': null,
};

function formatGeneratedDate(): string {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

interface ShopeeTabProps {
  isActive: boolean;
  clientId: number | null;
  omzetOld: number | null;
  omzetCur: number | null;
  onOmzetOldChange: (v: number | null) => void;
  onOmzetCurChange: (v: number | null) => void;
  onGenerated: (data: PlatformResultData) => void;
  onInvalidate: () => void;
}

export function ShopeeTab({ isActive, clientId, omzetOld, omzetCur, onOmzetOldChange, onOmzetCurChange, onGenerated, onInvalidate }: ShopeeTabProps) {
  const periodOld = usePeriodLabel('Bulan Lalu');
  const periodCur = usePeriodLabel('Bulan Ini');

  const [adsFiles, setAdsFiles] = useState(EMPTY_ADS_FILES);
  const [overviewFiles, setOverviewFiles] = useState(EMPTY_OVERVIEW_FILES);
  const [productPerformanceFile, setProductPerformanceFile] = useState<ProductPerformanceFileState | null>(null);

  // Fase 3 — Shopee Deep-Dive: category/series lookup for the current
  // client, fetched fresh whenever the client changes.
  const [productMaster, setProductMaster] = useState<ProductMasterEntry[]>([]);
  useEffect(() => {
    if (!clientId) {
      setProductMaster([]);
      return;
    }
    let cancelled = false;
    getProductMaster(clientId)
      .then((rows) => {
        if (!cancelled) setProductMaster(rows);
      })
      .catch(() => {
        if (!cancelled) setProductMaster([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Day counts of the last-parsed old/cur period (Fase 1) — used at Generate
  // time to warn when the two periods being compared aren't the same length.
  const [periodOldDays, setPeriodOldDays] = useState<number | null>(null);
  const [periodCurDays, setPeriodCurDays] = useState<number | null>(null);
  // Fase 2: the same period's actual start/end dates, kept alongside the day
  // count — needed to key a saved report_run's unique brand+platform+period
  // scope (the day count alone isn't enough to identify *which* period).
  const [periodOldRange, setPeriodOldRange] = useState<DateRange>(EMPTY_RANGE);
  const [periodCurRange, setPeriodCurRange] = useState<DateRange>(EMPTY_RANGE);

  const [report, setReport] = useState<ShopeeReport | null>(null);
  const [deepDive, setDeepDive] = useState<ShopeeDeepDiveReport | null>(null);
  const [itemPivotTab, setItemPivotTab] = useState<'produk' | 'keyword'>('produk');
  const [generatedAt, setGeneratedAt] = useState('');

  // Metric picker state for the item-level pivots: `null` selections mean
  // "use the report's own default" (auto-picked dominant metric for produk;
  // Biaya/Pesanan/CPP for keyword; Pengunjung+Penjualan for the daily trend)
  // until the user actually picks something. customMetrics holds every
  // custom-formula metric the user has defined this session, shared across
  // the produk/keyword pickers.
  const [produkSelections, setProdukSelections] = useState<MetricSelection[] | null>(null);
  const [keywordSelections, setKeywordSelections] = useState<MetricSelection[] | null>(null);
  const [customMetrics, setCustomMetrics] = useState<MetricSelection[]>([]);
  const [dailyTrendSelections, setDailyTrendSelections] = useState<DailyTrendMetricSelection[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleAdsFile(file: File, key: AdsFileKey) {
    const basics = validateFileBasics(file, ['.csv', '.xlsx', '.xls']);
    if (!basics.ok) {
      setUploadError(basics.message || 'File tidak valid.');
      return;
    }
    try {
      // Ported 1:1: the original always reads Shopee Ads uploads as text
      // (readAsText), even though the dropzone also accepts .xlsx/.xls — in
      // practice Shopee's Iklan Toko/Iklan Produk export is CSV-only.
      const text = await file.text();
      const { rows, period } = parseShopeeCSV(text);
      if (!rows.length) {
        setUploadError('File kosong atau format tidak dikenali.');
        return;
      }
      const cols = requireColumns(rows, [{ label: 'Biaya', kw: ['biaya'] }]);
      if (!cols.ok) {
        setUploadError(cols.message || 'Kolom wajib tidak ditemukan.');
        return;
      }
      setUploadError(null);
      setAdsFiles((prev) => ({ ...prev, [key]: { rows, fileName: file.name, file } }));
      const isOld = key.endsWith('-old');
      (isOld ? periodOld : periodCur).autoFill(period.label);
      if (period.days != null) (isOld ? setPeriodOldDays : setPeriodCurDays)(period.days);
      (isOld ? setPeriodOldRange : setPeriodCurRange)({ start: toISODate(period.start), end: toISODate(period.end) });
      setReport(null);
      setDeepDive(null);
      onInvalidate();
    } catch (err) {
      setUploadError('Gagal membaca isi file: ' + (err as Error).message);
    }
  }

  async function handleOverviewFile(file: File, key: OverviewFileKey) {
    const basics = validateFileBasics(file, ['.csv', '.xlsx', '.xls']);
    if (!basics.ok) {
      setUploadError(basics.message || 'File tidak valid.');
      return;
    }
    try {
      const rows = await readSpreadsheetFile(file);
      if (!rows.length) {
        setUploadError('File kosong.');
        return;
      }
      const cols = requireColumns(rows, [{ label: 'Kunjungan', kw: ['kunjungan'] }]);
      if (!cols.ok) {
        setUploadError(cols.message || 'Kolom wajib tidak ditemukan.');
        return;
      }
      setUploadError(null);
      const period = periodFromOverviewFilename(file.name);
      setOverviewFiles((prev) => ({ ...prev, [key]: { rows, fileName: file.name, period } }));
      setReport(null);
      setDeepDive(null);
      onInvalidate();
    } catch (err) {
      setUploadError('Gagal membaca isi file: ' + (err as Error).message);
    }
  }

  async function handleProductPerformanceFile(file: File) {
    const basics = validateFileBasics(file, ['.xlsx', '.xls']);
    if (!basics.ok) {
      setUploadError(basics.message || 'File tidak valid.');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const mainSheet = wb.Sheets['Produk dengan Performa Terbaik'];
      if (!mainSheet) {
        setUploadError('Sheet "Produk dengan Performa Terbaik" tidak ditemukan di file ini — pastikan Anda export dari menu yang benar di Product Performance.');
        return;
      }
      const mainRows = XLSX.utils.sheet_to_json(mainSheet, { defval: '' }) as SheetRow[];
      const tingkatkanSheet = wb.Sheets['Tingkatkan dengan Iklan'];
      const tingkatkanRows = tingkatkanSheet ? (XLSX.utils.sheet_to_json(tingkatkanSheet, { defval: '' }) as SheetRow[]) : [];
      setUploadError(null);
      setProductPerformanceFile({ mainRows, tingkatkanRows, fileName: file.name, file });
      setReport(null);
      setDeepDive(null);
      onInvalidate();
    } catch (err) {
      setUploadError('Gagal membaca isi file: ' + (err as Error).message);
    }
  }

  // Wajib: klien, Total Omzet Toko, dan Iklan Produk (2 periode). Semua
  // channel/file lain — Iklan Toko, Produk Otomatis, Toko-Keyword, Live,
  // Product Overview, Product Performance — opsional, insight tambahan saja.
  const hasProduk = Boolean(adsFiles['produk-old'] && adsFiles['produk-cur']);
  const ready = hasProduk && (omzetOld ?? 0) > 0 && (omzetCur ?? 0) > 0 && Boolean(clientId);
  // Whether each optional channel actually has anything uploaded — used to
  // hide that channel's whole report section rather than showing an
  // all-zero pivot for a channel the user never touched.
  const hasTokoData = Boolean(adsFiles['toko-old'] || adsFiles['toko-cur']);
  const hasLiveData = Boolean(adsFiles['live-old'] || adsFiles['live-cur']);
  const hasTokoKeywordData = Boolean(adsFiles['toko-keyword-old'] || adsFiles['toko-keyword-cur']);
  // Shown right in the upload area too (not just after Generate), as soon as
  // both periods' day counts are known from whichever file(s) were uploaded.
  const uploadPeriodWarning = comparePeriodDays(periodOldDays, periodCurDays);

  const autoSave = useAutoSave('shopee');

  function generate() {
    const r = buildShopeeReport({
      p1: periodOld.label,
      p2: periodCur.label,
      periodOldDays,
      periodCurDays,
      tokoOld: adsFiles['toko-old']?.rows ?? [],
      tokoCur: adsFiles['toko-cur']?.rows ?? [],
      produkOld: adsFiles['produk-old']?.rows ?? [],
      produkCur: adsFiles['produk-cur']?.rows ?? [],
      omzetOld: omzetOld ?? 0,
      omzetCur: omzetCur ?? 0,
      overviewOldRows: overviewFiles['overview-old']?.rows ?? null,
      overviewCurRows: overviewFiles['overview-cur']?.rows ?? null,
    });
    const dd = buildShopeeDeepDiveReport({
      produkOld: adsFiles['produk-old']?.rows ?? [],
      produkCur: adsFiles['produk-cur']?.rows ?? [],
      produkOtomatisOld: adsFiles['produk-otomatis-old']?.rows ?? [],
      produkOtomatisCur: adsFiles['produk-otomatis-cur']?.rows ?? [],
      tokoOld: adsFiles['toko-old']?.rows ?? [],
      tokoCur: adsFiles['toko-cur']?.rows ?? [],
      tokoKeywordOld: adsFiles['toko-keyword-old']?.rows ?? [],
      tokoKeywordCur: adsFiles['toko-keyword-cur']?.rows ?? [],
      liveOld: adsFiles['live-old']?.rows ?? [],
      liveCur: adsFiles['live-cur']?.rows ?? [],
      productPerformanceRows: productPerformanceFile?.mainRows ?? null,
      tingkatkanDenganIklanRows: productPerformanceFile?.tingkatkanRows ?? null,
      overviewOldRows: overviewFiles['overview-old']?.rows ?? null,
      overviewCurRows: overviewFiles['overview-cur']?.rows ?? null,
      productMaster,
      omzetOld: omzetOld ?? 0,
      omzetCur: omzetCur ?? 0,
      produkSelections,
      keywordSelections,
      dailyTrendSelections,
    });
    // Only default the open tab to the dominant channel on the very first
    // Generate — a later regenerate (metric change, uncategorized-mapping
    // save) shouldn't yank the user back to a tab they've since switched
    // away from.
    if (!report) setItemPivotTab(dd.dominantChannel === 'toko' ? 'keyword' : 'produk');
    setReport(r);
    setDeepDive(dd);
    setGeneratedAt(formatGeneratedDate());
    onGenerated({ period: { old: r.p1, cur: r.p2 }, kpis: r.summary.kpis, spend: r.summary.spend });
    autoSave.save(clientId, buildSavePayload(), buildSaveFiles());
  }

  // Re-runs Generate after the user completes an "Uncategorized" mapping or
  // changes an item-pivot metric selection, so the report (and its
  // autosave) stay in sync without a manual re-click. Guarded so this never
  // fires before the first real Generate.
  useEffect(() => {
    if (report && deepDive) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productMaster, produkSelections, keywordSelections, dailyTrendSelections]);

  async function handleSaveCategory(name: string, category: string, series: string) {
    if (!clientId) return;
    await saveProductMasterEntry(clientId, { namaProdukClean: name, category, series });
    setProductMaster((prev) => [...prev.filter((p) => p.namaProdukClean !== name), { namaProdukClean: name, category, series }]);
  }

  function reset() {
    periodOld.reset();
    periodCur.reset();
    onOmzetOldChange(null);
    onOmzetCurChange(null);
    setAdsFiles(EMPTY_ADS_FILES);
    setOverviewFiles(EMPTY_OVERVIEW_FILES);
    setProductPerformanceFile(null);
    setPeriodOldDays(null);
    setPeriodCurDays(null);
    setPeriodOldRange(EMPTY_RANGE);
    setPeriodCurRange(EMPTY_RANGE);
    setReport(null);
    setDeepDive(null);
    setProdukSelections(null);
    setKeywordSelections(null);
    setCustomMetrics([]);
    setDailyTrendSelections(null);
    setUploadError(null);
    onInvalidate();
  }

  function buildSavePayload(): Omit<SaveReportPayload, 'brandId' | 'platform'> {
    const produkMergedOld = mergeProdukOtomatis(adsFiles['produk-old']?.rows ?? [], adsFiles['produk-otomatis-old']?.rows ?? []);
    const produkMergedCur = mergeProdukOtomatis(adsFiles['produk-cur']?.rows ?? [], adsFiles['produk-otomatis-cur']?.rows ?? []);
    const catOld = categorizeProdukRows(produkMergedOld, 'Nama Iklan', productMaster);
    const catCur = categorizeProdukRows(produkMergedCur, 'Nama Iklan', productMaster);
    const catMapOld: ShopeeCategorization = new Map(catOld.rows.map((cr) => [cr.row, { cleanName: cr.cleanName, category: cr.category, series: cr.series }]));
    const catMapCur: ShopeeCategorization = new Map(catCur.rows.map((cr) => [cr.row, { cleanName: cr.cleanName, category: cr.category, series: cr.series }]));

    return {
      period: { oldStart: periodOldRange.start, oldEnd: periodOldRange.end, curStart: periodCurRange.start, curEnd: periodCurRange.end, oldLabel: periodOld.label, curLabel: periodCur.label },
      reportConfig: { omzetOld: omzetOld ?? 0, omzetCur: omzetCur ?? 0 },
      rows: {
        shopee: [
          ...mapShopeeRows(produkMergedOld, 'produk', 'old', catMapOld),
          ...mapShopeeRows(produkMergedCur, 'produk', 'cur', catMapCur),
          ...mapShopeeRows(adsFiles['toko-old']?.rows ?? [], 'toko', 'old'),
          ...mapShopeeRows(adsFiles['toko-cur']?.rows ?? [], 'toko', 'cur'),
          ...mapShopeeRows(adsFiles['toko-keyword-old']?.rows ?? [], 'toko_keyword', 'old'),
          ...mapShopeeRows(adsFiles['toko-keyword-cur']?.rows ?? [], 'toko_keyword', 'cur'),
          ...mapShopeeRows(adsFiles['live-old']?.rows ?? [], 'live', 'old'),
          ...mapShopeeRows(adsFiles['live-cur']?.rows ?? [], 'live', 'cur'),
        ],
      },
    };
  }

  function buildSaveFiles(): RawFileEntry[] {
    const entries: (RawFileEntry | null)[] = [
      adsFiles['toko-old'] ? { file: adsFiles['toko-old'].file, channel: 'toko', periodRole: 'old' } : null,
      adsFiles['toko-cur'] ? { file: adsFiles['toko-cur'].file, channel: 'toko', periodRole: 'cur' } : null,
      adsFiles['produk-old'] ? { file: adsFiles['produk-old'].file, channel: 'produk', periodRole: 'old' } : null,
      adsFiles['produk-cur'] ? { file: adsFiles['produk-cur'].file, channel: 'produk', periodRole: 'cur' } : null,
      adsFiles['produk-otomatis-old'] ? { file: adsFiles['produk-otomatis-old'].file, channel: 'produk_otomatis', periodRole: 'old' } : null,
      adsFiles['produk-otomatis-cur'] ? { file: adsFiles['produk-otomatis-cur'].file, channel: 'produk_otomatis', periodRole: 'cur' } : null,
      adsFiles['toko-keyword-old'] ? { file: adsFiles['toko-keyword-old'].file, channel: 'toko_keyword', periodRole: 'old' } : null,
      adsFiles['toko-keyword-cur'] ? { file: adsFiles['toko-keyword-cur'].file, channel: 'toko_keyword', periodRole: 'cur' } : null,
      adsFiles['live-old'] ? { file: adsFiles['live-old'].file, channel: 'live', periodRole: 'old' } : null,
      adsFiles['live-cur'] ? { file: adsFiles['live-cur'].file, channel: 'live', periodRole: 'cur' } : null,
      productPerformanceFile ? { file: productPerformanceFile.file, channel: 'produk_performance', periodRole: 'cur' } : null,
    ];
    return entries.filter((f): f is RawFileEntry => f !== null);
  }

  function adsDropzone(key: AdsFileKey, tag: string) {
    const f = adsFiles[key];
    return (
      <Dropzone
        tag={tag}
        accept=".csv,.xlsx,.xls"
        onFile={(file) => handleAdsFile(file, key)}
        loaded={Boolean(f)}
        fileName={f?.fileName}
        infoText={f ? `${f.rows.length} baris` : undefined}
        className="shopee-dz"
      />
    );
  }

  function overviewDropzone(key: OverviewFileKey) {
    const f = overviewFiles[key];
    return (
      <Dropzone
        tag={key === 'overview-old' ? 'Periode Lalu' : 'Periode Ini'}
        accept=".csv,.xlsx,.xls"
        onFile={(file) => handleOverviewFile(file, key)}
        loaded={Boolean(f)}
        fileName={f?.fileName}
        infoText={f ? `${f.rows.length} hari${f.period ? ' · ' + f.period : ''}` : undefined}
        className="shopee-dz"
        icon="📊"
      />
    );
  }

  const steps: Step[] = [
    {
      label: 'Isi Total Omzet Toko & upload Iklan Produk',
      sub: hasProduk ? 'Iklan Produk 2 periode sudah terbaca' : undefined,
      status: hasProduk && (omzetOld ?? 0) > 0 && (omzetCur ?? 0) > 0 ? 'done' : 'current',
    },
    { label: 'Generate laporan', status: report ? 'done' : ready ? 'current' : 'todo' },
    { label: 'Lihat & unduh PDF', status: report ? 'current' : 'todo' },
  ];

  return (
    <div className={`panel${isActive ? ' active' : ''}`}>
      <HowTo>
        <HowToStep num={1} numClassName="shopee-num" title="Download report Iklan Produk">
          Dari dashboard Shopee Seller Center, buka menu <strong>Iklan Saya</strong> dan download laporan <strong>Iklan Produk</strong> dan iklan lainnya (jika tersedia), untuk periode lalu dan periode ini.
        </HowToStep>
        <HowToStep num={2} numClassName="shopee-num" title="Catat Total Omzet Toko dari dashboard">
          Buka halaman <strong>Performa Toko</strong> di Shopee Seller Center dan pilih status <strong>'Pesanan Dibuat'</strong>. Angka ini tidak tersedia di dalam file sehingga perlu diisi manual.
        </HowToStep>
        <HowToStep num={3} numClassName="shopee-num" title="(Opsional) Upload data untuk analisis mendalam">
          Untuk analisis lebih dalam, tambahkan juga Iklan Produk Otomatis, Iklan Toko - Keyword (jika menggunakan iklan toko), Product Overview & Product Performance untuk insight tambahan. Semuanya opsional, laporan tetap bisa dibuat tanpanya.
        </HowToStep>
        <HowToStep num={4} numClassName="shopee-num" title="Upload file & generate laporan">
          Isi kolom Total Omzet, upload Iklan Produk, lalu klik <strong>Generate Laporan</strong>.
        </HowToStep>
      </HowTo>

      <StepIndicator steps={steps} accent="var(--shopee)" />

      <PeriodInputRow
        colorClass="shopee-period"
        oldValue={periodOld.inputValue}
        curValue={periodCur.inputValue}
        onOldChange={periodOld.onInput}
        onCurChange={periodCur.onInput}
        oldPlaceholder="cth: Apr 2026 / W1 Mei"
        curPlaceholder="cth: Mei 2026 / W2 Mei"
      />
      <PeriodWarningBanner message={uploadPeriodWarning} />
      {uploadError && <InlineNotice title="File ini belum kebaca">{uploadError}</InlineNotice>}

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Total Omzet Toko (Pesanan Dibuat)</div>
        </div>
        <div className="omzet-row">
          <OmzetField
            label="Bulan Lalu"
            value={omzetOld}
            onChange={(v) => {
              onOmzetOldChange(v);
              setReport(null);
              setDeepDive(null);
              onInvalidate();
            }}
          />
          <OmzetField
            label="Bulan Ini"
            value={omzetCur}
            onChange={(v) => {
              onOmzetCurChange(v);
              setReport(null);
              setDeepDive(null);
              onInvalidate();
            }}
          />
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Iklan Produk</div>
        </div>
        <div className="dz-grid-4">
          {adsDropzone('produk-old', 'Periode Lalu')}
          {adsDropzone('produk-cur', 'Periode Ini')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Iklan Produk Otomatis</div>
          <span className="sec-badge">opsional — untuk analisis per produk</span>
        </div>
        <div className="dz-grid-4">
          {adsDropzone('produk-otomatis-old', 'Periode Lalu')}
          {adsDropzone('produk-otomatis-cur', 'Periode Ini')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Iklan Toko</div>
          <span className="sec-badge">opsional</span>
        </div>
        <div className="dz-grid-4">
          {adsDropzone('toko-old', 'Periode Lalu')}
          {adsDropzone('toko-cur', 'Periode Ini')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Iklan Toko - Keyword</div>
          <span className="sec-badge">opsional — untuk analisis per keyword</span>
        </div>
        <div className="dz-grid-4">
          {adsDropzone('toko-keyword-old', 'Periode Lalu')}
          {adsDropzone('toko-keyword-cur', 'Periode Ini')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Iklan Live</div>
          <span className="sec-badge">opsional</span>
        </div>
        <div className="dz-grid-4">
          {adsDropzone('live-old', 'Periode Lalu')}
          {adsDropzone('live-cur', 'Periode Ini')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Product Overview (Toko)</div>
          <span className="sec-badge">opsional — untuk tren harian</span>
        </div>
        <div className="dz-grid-4">
          {overviewDropzone('overview-old')}
          {overviewDropzone('overview-cur')}
        </div>
      </div>

      <div className="source-block">
        <div className="source-header">
          <div className="source-label shopee-label">Product Performance</div>
          <span className="sec-badge">opsional — 1 file, tidak dibandingkan 2 periode</span>
        </div>
        <div className="empty-note" style={{ padding: '0 1.4rem .6rem' }}>
          Gunakan data dari <strong>periode ini</strong> (bulan ini), bukan periode lalu — file ini tidak dibandingkan antar periode, jadi cukup 1 snapshot terbaru.
        </div>
        <div className="empty-note" style={{ padding: '0 1.4rem .6rem' }}>
          Saat mengunduh file ini dari Shopee Seller Center, gunakan status <strong>"Siap Dikirim"</strong>.
        </div>
        <div className="dz-grid-4">
          <Dropzone
            tag="Produk dengan Performa Terbaik"
            accept=".xlsx,.xls"
            onFile={handleProductPerformanceFile}
            loaded={Boolean(productPerformanceFile)}
            fileName={productPerformanceFile?.fileName}
            infoText={productPerformanceFile ? `${productPerformanceFile.mainRows.length} baris` : undefined}
            className="shopee-dz"
            icon="📦"
          />
        </div>
      </div>

      {ready && (
        <div id="cta" style={{ marginTop: '1rem' }}>
          <div className="action-row">
            <button className="btn btn-primary" onClick={generate}>
              ✦ Generate Laporan
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              ↺ Reset
            </button>
          </div>
        </div>
      )}

      {report && (
        <div id="report-shopee">
          <div className="report-top">
            <div className="report-title">Performance Report</div>
            <div className="report-period">
              <PeriodCompareChip old={report.p1} cur={report.p2} onBrand />
            </div>
            <div className="report-meta num">Generated {generatedAt}</div>
          </div>
          <div data-role="r-body">
            <PeriodWarningBanner message={report.periodWarning} />

            {deepDive && (
              <>
                <ChannelPivotSection title="Iklan Shopee Overall" badge="Semua Channel" rows={deepDive.overall} p1={report.p1} p2={report.p2} />
                <ChannelPivotSection title="Iklan Produk" badge="+ Iklan Produk Otomatis" rows={deepDive.produk} p1={report.p1} p2={report.p2} />
                {hasTokoData && <ChannelPivotSection title="Iklan Toko" badge="Shop+ Ads" rows={deepDive.toko} p1={report.p1} p2={report.p2} />}
                {hasLiveData && <ChannelPivotSection title="Iklan Live" badge="Penonton-based" rows={deepDive.live} p1={report.p1} p2={report.p2} />}

                {report.productOverviewRows && (
                  <div className="sec-block">
                    <div className="sec-heading shopee-heading">
                      Shopee Toko <span className="sec-badge">Product Overview</span>
                      <SectionDownloadButton />
                    </div>
                    <div style={{ padding: '0 1.4rem 1.4rem' }}>
                      <KpiTable rows={report.productOverviewRows} p1={report.p1} p2={report.p2} />
                    </div>
                  </div>
                )}

                <ItemPivotSection
                  produkRows={deepDive.produkPivot}
                  produkSelections={deepDive.produkSelections}
                  onProdukSelectionsChange={setProdukSelections}
                  keywordRows={deepDive.keywordPivot}
                  hasKeywordData={hasTokoKeywordData}
                  keywordSelections={deepDive.keywordSelections}
                  onKeywordSelectionsChange={setKeywordSelections}
                  customMetrics={customMetrics}
                  onAddCustomMetric={(sel) => setCustomMetrics((prev) => [...prev, sel])}
                  activeTab={hasTokoKeywordData ? itemPivotTab : 'produk'}
                  onTabChange={setItemPivotTab}
                  p1={report.p1}
                  p2={report.p2}
                />
                <UncategorizedPanel names={deepDive.uncategorized} onSave={handleSaveCategory} />
                <UnadvertisedVariantsTable rows={deepDive.unadvertisedVariants} hasFile={deepDive.hasProductPerformanceData} />
                <TingkatkanDenganIklanTable rows={deepDive.tingkatkanDenganIklanRows} />
                <DailyTrendSection rows={deepDive.dailyTrendPivot} selections={deepDive.dailyTrendSelections} onSelectionsChange={setDailyTrendSelections} p1={report.p1} p2={report.p2} />
              </>
            )}
          </div>
          <div className="action-row" style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <DownloadPdfButton targetId="report-shopee" filename="Performance Report - Shopee Ads.pdf" />
            <button className="btn btn-ghost" onClick={reset}>
              ↺ Upload Data Baru
            </button>
          </div>
          <SaveStatus status={autoSave.status} message={autoSave.message} />
        </div>
      )}
    </div>
  );
}
