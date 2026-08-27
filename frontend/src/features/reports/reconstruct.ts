import { buildMetaReport, type MetaReport } from '../meta/metaReport';
import { buildShopeeReport, type ShopeeReport } from '../shopee/shopeeReport';
import { buildTiktokReport, type TiktokReport } from '../tiktok/tiktokReport';
import { findCol } from '../../lib/columns';
import type { MetaIndustry } from '../../lib/meta';
import { daysBetweenInclusive } from '../../lib/periodLabel';
import type { SheetRow } from '../../lib/types';
import type { ReportDetail } from './types';

// Rehydrates a saved report_run + its fact rows back into the same
// MetaReport/ShopeeReport/TiktokReport shape the tab's own generate() step
// produces, by feeding the rows' `extra` (the complete original parsed row,
// stashed verbatim at save time) back through the exact same
// buildXReport() functions — so Report History renders with zero
// duplicated report logic and stays byte-for-byte consistent with a live
// generate().
//
// Trade-off: Shopee's Product Overview table (shopee_store_overview_daily,
// a Fase 3 table) isn't persisted in Fase 2, so a reopened Shopee report
// never shows that section even if the original generate() had it.

function extraOf(row: Record<string, unknown>): SheetRow {
  return (row.extra as SheetRow | null) ?? {};
}

function parseISODate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysOf(start: string | null, end: string | null): number | null {
  const s = parseISODate(start);
  const e = parseISODate(end);
  return s && e ? daysBetweenInclusive(s, e) : null;
}

export function reconstructShopeeReport(detail: ReportDetail): ShopeeReport {
  const { report, rows } = detail;
  const byChannelRole = (channel: string, role: string) => rows.filter((r) => r.channel === channel && r.period_role === role).map((r) => extraOf(r));
  const config = (report.reportConfig ?? {}) as { omzetOld?: number; omzetCur?: number };
  return buildShopeeReport({
    p1: report.periodOldLabel ?? '',
    p2: report.periodCurLabel ?? '',
    periodOldDays: daysOf(report.periodOldStart, report.periodOldEnd),
    periodCurDays: daysOf(report.periodCurStart, report.periodCurEnd),
    tokoOld: byChannelRole('toko', 'old'),
    tokoCur: byChannelRole('toko', 'cur'),
    produkOld: byChannelRole('produk', 'old'),
    produkCur: byChannelRole('produk', 'cur'),
    omzetOld: config.omzetOld ?? 0,
    omzetCur: config.omzetCur ?? 0,
    overviewOldRows: null,
    overviewCurRows: null,
  });
}

export function reconstructMetaReport(detail: ReportDetail): MetaReport {
  const { report, rows } = detail;
  const config = (report.reportConfig ?? {}) as {
    industry?: MetaIndustry;
    customResultsCol?: string | null;
    metaHeaders?: string[];
    cpasHeaders?: string[];
  };
  const mainRows = rows.filter((r) => r.channel === 'boost' || r.channel === 'nonboost').map((r) => extraOf(r));
  const cpasRowsAll = rows.filter((r) => r.channel === 'cpas_overall').map((r) => extraOf(r));
  // Prefer the header order captured at save time (see MetaTab's
  // buildSavePayload) over Object.keys() on the rehydrated rows — Postgres's
  // jsonb storage does not preserve object key order, which would otherwise
  // silently corrupt buildMetaReport's order-sensitive column matching.
  const metaHeaders = config.metaHeaders ?? (mainRows.length ? Object.keys(mainRows[0]) : []);
  const cpasHeaders = config.cpasHeaders ?? (cpasRowsAll.length ? Object.keys(cpasRowsAll[0]) : []);
  // Day-breakdown Meta files have no Month column at all — buildMetaReport
  // needs an explicit dayRanges to split them, otherwise it falls through to
  // the month-mode splitMonths() path and finds nothing to split on. The
  // exact old/cur boundaries the user picked at save time are recoverable
  // from the persisted period start/end dates, regardless of mode.
  const dayCol = findCol(mainRows, ['day']);
  const oldStart = parseISODate(report.periodOldStart);
  const oldEnd = parseISODate(report.periodOldEnd);
  const curStart = parseISODate(report.periodCurStart);
  const curEnd = parseISODate(report.periodCurEnd);
  const dayRanges = dayCol && oldStart && oldEnd && curStart && curEnd ? { old: { start: oldStart, end: oldEnd }, cur: { start: curStart, end: curEnd } } : null;
  return buildMetaReport({
    metaRows: mainRows,
    metaHeaders,
    cpasRows: cpasRowsAll.length ? cpasRowsAll : null,
    cpasHeaders,
    industry: config.industry ?? null,
    customResultsCol: config.customResultsCol ?? null,
    dayRanges,
  });
}

export function reconstructTiktokReport(detail: ReportDetail): TiktokReport {
  const { report, rows } = detail;
  const oldRows = rows.filter((r) => r.period_role === 'old').map((r) => extraOf(r));
  const curRows = rows.filter((r) => r.period_role === 'cur').map((r) => extraOf(r));
  return buildTiktokReport(report.periodOldLabel ?? '', report.periodCurLabel ?? '', daysOf(report.periodOldStart, report.periodOldEnd), daysOf(report.periodCurStart, report.periodCurEnd), oldRows, curRows);
}
