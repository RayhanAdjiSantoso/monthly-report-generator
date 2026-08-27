import { Router } from 'express';
import { pool } from '../db.js';

export const productMasterRouter = Router();

// Fase 3 — Shopee Deep-Dive: category/series lookup per brand. Read by the
// frontend before generating a Deep-Dive report (to match cleaned ad names
// against a known category/series), written by the inline "complete the
// mapping" form the report shows for anything left "Uncategorized".

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
