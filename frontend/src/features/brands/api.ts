const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export type BrandNoteKind = 'win' | 'con' | 'note';

export interface BrandNote {
  id: number;
  period: string;
  kind: BrandNoteKind;
  body: string;
  sortOrder: number;
}

export interface Brand {
  id: number;
  name: string;
  category: string;
  description: string;
  updatedAt: string | null;
  notes: BrandNote[];
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `Request gagal (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const req = (path: string, init?: RequestInit) =>
  fetch(`${API_BASE}/api/brands${path}`, {
    credentials: 'include',
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

export const getBrands = () => req('').then((r) => asJson<Brand[]>(r));

export const createBrand = (input: { name: string; category?: string; description?: string }) =>
  req('', { method: 'POST', body: JSON.stringify(input) }).then((r) => asJson<Brand>(r));

export const updateBrand = (id: number, patch: { name?: string; category?: string; description?: string }) =>
  req(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => asJson<{ ok: true }>(r));

export const addNote = (brandId: number, input: { period: string; kind: BrandNoteKind; body: string }) =>
  req(`/${brandId}/notes`, { method: 'POST', body: JSON.stringify(input) }).then((r) => asJson<BrandNote>(r));

export const updateNote = (brandId: number, noteId: number, patch: Partial<{ period: string; kind: BrandNoteKind; body: string }>) =>
  req(`/${brandId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => asJson<BrandNote>(r));

export const deleteNote = (brandId: number, noteId: number) =>
  req(`/${brandId}/notes/${noteId}`, { method: 'DELETE' }).then((r) => asJson<{ ok: true }>(r));
