import { Router } from 'express';
import { pool } from '../db.js';
import { buildBulkInsert } from '../sqlHelpers.js';

export const productMasterRouter = Router();

// Fase 3 — Shopee Deep-Dive: category/series lookup per brand. Read by the
// frontend before generating a Deep-Dive report (to match cleaned ad names
// against a known category/series), written by the inline "complete the
// mapping" form the report shows for anything left "Uncategorized" AND by a
// full-replace upload of the "Referensi Kategori Produk" file (PUT /).

productMasterRouter.get('/', async (req, res) => {
  const brandId = req.query.brandId ? Number(req.query.brandId) : null;
  if (!brandId || !Number.isFinite(brandId)) {
    res.status(400).json({ error: 'brandId is required' });
    return;
  }
  const { rows } = await pool.query<{ nama_produk_clean: string; category: string; series: string }>(
    'SELECT nama_produk_clean, category, series FROM ads_reports.product_master WHERE brand_id = $1 ORDER BY nama_produk_clean',
    [brandId],
  );
  res.json(rows.map((r) => ({ namaProdukClean: r.nama_produk_clean, category: r.category, series: r.series })));
});

// Full replace for one brand — the "Referensi Kategori Produk" upload. The
// file IS the mapping, so a re-upload with fewer rows should drop the ones
// it no longer lists (chosen semantics: "replace penuh", which also clears
// entries added earlier via the per-item panel — expected).
interface ProductMasterEntryInput {
  namaProdukClean: string;
  category: string;
  series: string;
}

productMasterRouter.put('/', async (req, res) => {
  const brandId = typeof req.body?.brandId === 'number' ? req.body.brandId : null;
  const rawEntries: unknown = req.body?.entries;
  if (!brandId || !Array.isArray(rawEntries)) {
    res.status(400).json({ error: 'brandId (number) and entries (array) are required' });
    return;
  }
  const entries: ProductMasterEntryInput[] = [];
  const seen = new Set<string>();
  for (const e of rawEntries) {
    const namaProdukClean = typeof (e as Record<string, unknown>)?.namaProdukClean === 'string' ? ((e as Record<string, unknown>).namaProdukClean as string).trim() : '';
    const category = typeof (e as Record<string, unknown>)?.category === 'string' ? ((e as Record<string, unknown>).category as string).trim() : '';
    const seriesRaw = typeof (e as Record<string, unknown>)?.series === 'string' ? ((e as Record<string, unknown>).series as string).trim() : '';
    if (!namaProdukClean || !category) continue;
    const key = namaProdukClean.toLowerCase();
    if (seen.has(key)) continue; // UNIQUE (brand_id, nama_produk_clean) — last would win; keep first, matching the frontend parser
    seen.add(key);
    entries.push({ namaProdukClean, category, series: seriesRaw || category });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM ads_reports.product_master WHERE brand_id = $1', [brandId]);
    const insert = buildBulkInsert(
      'ads_reports.product_master',
      ['brand_id', 'nama_produk_clean', 'category', 'series'],
      entries.map((e) => [brandId, e.namaProdukClean, e.category, e.series]),
    );
    if (insert) await client.query(insert.text, insert.values);
    await client.query('COMMIT');
    res.json(entries);
  } catch (err) {
    await client.query('ROLLBACK');
    const pgErr = err as { code?: string };
    if (pgErr.code === '23503') {
      res.status(400).json({ error: 'brandId does not reference an existing brand.' });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

productMasterRouter.post('/', async (req, res) => {
  const brandId = typeof req.body?.brandId === 'number' ? req.body.brandId : null;
  const namaProdukClean = typeof req.body?.namaProdukClean === 'string' ? req.body.namaProdukClean.trim() : '';
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
  const series = typeof req.body?.series === 'string' ? req.body.series.trim() : '';
  if (!brandId || !namaProdukClean || !category) {
    res.status(400).json({ error: 'brandId, namaProdukClean, and category are required' });
    return;
  }
  try {
    await pool.query(
      `INSERT INTO ads_reports.product_master (brand_id, nama_produk_clean, category, series)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (brand_id, nama_produk_clean) DO UPDATE SET category = EXCLUDED.category, series = EXCLUDED.series`,
      [brandId, namaProdukClean, category, series],
    );
    res.status(201).json({ namaProdukClean, category, series });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23503') {
      res.status(400).json({ error: 'brandId does not reference an existing brand.' });
      return;
    }
    throw err;
  }
});
