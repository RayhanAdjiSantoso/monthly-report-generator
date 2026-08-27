import type { SheetRow } from './types';

// ══════════════════════════════════════════════════════
// FASE 3 — SHOPEE DEEP-DIVE
// Step 2: cleaning nama iklan + mapping category/series lewat product_master
// ══════════════════════════════════════════════════════

// Strips Shopee's own "[n]" counter suffix (appended when the same product
// gets re-launched as a new ad, e.g. "Produk X [2]") and collapses extra
// whitespace, so ads for the same underlying product group together under
// one clean name for pivoting/category matching.
export function cleanAdName(raw: unknown): string {
  const s = String(raw ?? '');
  return s
    .replace(/\s*\[\d+\]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ProductMasterEntry {
  namaProdukClean: string;
  category: string;
  series: string;
}

export interface CategoryMatch {
  category: string;
  series: string;
}

// Exact match (case-insensitive, trimmed) against product_master — mirrors
// how the reference spreadsheet's own VLOOKUP joined Category/Series onto
// its raw Iklan Produk sheet by exact cleaned name (no Kode Produk involved
// — the reference mapping itself is keyed by product name).
export function matchProductMaster(cleanName: string, master: ProductMasterEntry[]): CategoryMatch | null {
  const key = cleanName.trim().toLowerCase();
  if (!key) return null;
  const hit = master.find((m) => m.namaProdukClean.trim().toLowerCase() === key);
  return hit ? { category: hit.category, series: hit.series } : null;
}

export const UNCATEGORIZED = 'Uncategorized';

export interface CategorizedRow {
  row: SheetRow;
  cleanName: string;
  category: string;
  series: string;
}

export interface CategorizeResult {
  rows: CategorizedRow[];
  // Distinct clean names with no product_master match, in first-seen order
  // — surfaced separately so the UI can list them for the user to complete
  // the mapping, instead of silently dropping them.
  uncategorized: string[];
}

export function categorizeProdukRows(rows: SheetRow[], nameCol: string, master: ProductMasterEntry[]): CategorizeResult {
  const uncategorizedSet = new Set<string>();
  const out: CategorizedRow[] = rows.map((row) => {
    const cleanName = cleanAdName(row[nameCol]);
    const match = matchProductMaster(cleanName, master);
    if (!match) uncategorizedSet.add(cleanName);
    return { row, cleanName, category: match?.category ?? UNCATEGORIZED, series: match?.series ?? UNCATEGORIZED };
  });
  return { rows: out, uncategorized: [...uncategorizedSet] };
}

// ══════════════════════════════════════════════════════
// Step 3: gabungkan "Iklan Produk Otomatis" ke dataset "Iklan Produk"
// ══════════════════════════════════════════════════════

const SUBTOTAL_ROW_NAME = 'iklan produk otomatis';

// Iklan Produk Otomatis rows are keyed by "Nama Produk", not "Nama Iklan" —
// normalized onto a shared `Nama Iklan` field so both datasets pivot
// together downstream. Both source files carry their own copy of the same
// subtotal row (literally named "Iklan Produk Otomatis") — one as a rollup
// row inside "Iklan Produk", one as the self-referential first row of
// "Iklan Produk Otomatis" itself (same underlying numbers, verified against
// the real export) — so a single post-merge filter on that exact name
// removes both at once instead of needing to special-case either file.
export function mergeProdukOtomatis(produkRows: SheetRow[], otomatisRows: SheetRow[]): SheetRow[] {
  const normalizedOtomatis = otomatisRows.map((r) => ({ ...r, 'Nama Iklan': r['Nama Produk'] }));
  return [...produkRows, ...normalizedOtomatis].filter((r) => cleanAdName(r['Nama Iklan']).toLowerCase() !== SUBTOTAL_ROW_NAME);
}
