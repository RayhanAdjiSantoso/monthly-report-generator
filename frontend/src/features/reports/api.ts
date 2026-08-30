import type { ProductMasterEntry } from '../../lib/shopeeDeepDive';
import type { Client, Platform, PeriodRole, RawFileEntry, ReportDetail, ReportListItem, SaveReportPayload, SavedPeriod, SavedPeriodDetail } from './types';

// Defaults to '' (same-origin relative /api/... requests) — correct for the
// Vercel deployment, where vercel.json rewrites /api/* to the backend
// function on the same domain, so no cross-origin request (and no CSP
// connect-src allowance) is ever needed. In local dev, vite.config.ts
// proxies /api to the backend dev server, so this stays '' there too.
// VITE_API_BASE_URL only needs to be set to point at a *separate-origin*
// backend (e.g. Render) — an explicit '' must not fall back to the old
// hardcoded localhost default, which is why this is `??` and not `||`.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getClients(): Promise<Client[]> {
  const res = await fetch(`${API_BASE}/api/clients`);
  return asJson<Client[]>(res);
}

export async function createClient(name: string): Promise<Client> {
  const res = await fetch(`${API_BASE}/api/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  return asJson<Client>(res);
}

export async function saveReport(payload: SaveReportPayload, files: RawFileEntry[]): Promise<{ id: number }> {
  const form = new FormData();
  form.append('payload', JSON.stringify(payload));
  form.append('fileMeta', JSON.stringify(files.map((f) => ({ channel: f.channel, periodRole: f.periodRole, originalFilename: f.file.name }))));
  files.forEach((f) => form.append('files', f.file, f.file.name));
  const res = await fetch(`${API_BASE}/api/reports`, { method: 'POST', body: form });
  return asJson<{ id: number }>(res);
}

export async function getReports(clientId: number, platform?: Platform): Promise<ReportListItem[]> {
  const params = new URLSearchParams({ client_id: String(clientId) });
  if (platform) params.set('platform', platform);
  const res = await fetch(`${API_BASE}/api/reports?${params.toString()}`);
  return asJson<ReportListItem[]>(res);
}

export async function getReportDetail(id: number): Promise<ReportDetail> {
  const res = await fetch(`${API_BASE}/api/reports/${id}`);
  return asJson<ReportDetail>(res);
}

// "Pilih dari data tersimpan" — periods this client has previously uploaded
// for a platform, and the stored rows for one of them.
export async function getSavedPeriods(clientId: number, platform: Platform): Promise<SavedPeriod[]> {
  const params = new URLSearchParams({ client_id: String(clientId), platform });
  const res = await fetch(`${API_BASE}/api/saved-periods?${params.toString()}`);
  return asJson<SavedPeriod[]>(res);
}

export async function getSavedPeriod(runId: number, role: PeriodRole): Promise<SavedPeriodDetail> {
  const res = await fetch(`${API_BASE}/api/reports/${runId}/period/${role}`);
  return asJson<SavedPeriodDetail>(res);
}

export async function deleteReport(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/reports/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `Request failed (${res.status})`);
  }
}

// Fase 3 — Shopee Deep-Dive category/series lookup.
export async function getProductMaster(brandId: number): Promise<ProductMasterEntry[]> {
  const res = await fetch(`${API_BASE}/api/product-master?brandId=${brandId}`);
  return asJson<ProductMasterEntry[]>(res);
}

export async function saveProductMasterEntry(brandId: number, entry: ProductMasterEntry): Promise<ProductMasterEntry> {
  const res = await fetch(`${API_BASE}/api/product-master`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, namaProdukClean: entry.namaProdukClean, category: entry.category, series: entry.series }),
  });
  return asJson<ProductMasterEntry>(res);
}

// Full replace of a client's category mapping — the "Referensi Kategori
// Produk" upload. Returns the entries actually stored (deduped/validated
// server-side).
export async function replaceProductMaster(brandId: number, entries: ProductMasterEntry[]): Promise<ProductMasterEntry[]> {
  const res = await fetch(`${API_BASE}/api/product-master`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, entries }),
  });
  return asJson<ProductMasterEntry[]>(res);
}
