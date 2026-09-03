import { Router } from 'express';
import { pool } from '../db.js';

export const brandsRouter = Router();

// Brand identity & history — the "Pengaturan Brand" page. A brand here is a
// row in public.brands (same table as the client picker); brand_profiles /
// brand_notes (migration 004) hang extra context off it.

const KINDS = new Set(['win', 'con', 'note']);
const str = (v: unknown, max = 4000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

interface NoteRow {
  id: number;
  brand_id: number;
  period: string;
  kind: string;
  body: string;
  sort_order: number;
}

function shapeNote(r: NoteRow) {
  return { id: r.id, period: r.period, kind: r.kind, body: r.body, sortOrder: r.sort_order };
}

// ── List: every brand + its profile + its notes ──────────────────────
brandsRouter.get('/', async (_req, res) => {
  const { rows: brands } = await pool.query<{ brand_id: number; brand_name: string; category: string | null; description: string | null; updated_at: string | null }>(
    `SELECT b.brand_id, b.brand_name, p.category, p.description, p.updated_at
       FROM public.brands b
       LEFT JOIN ads_reports.brand_profiles p ON p.brand_id = b.brand_id
      ORDER BY b.brand_name`,
  );
  const { rows: notes } = await pool.query<NoteRow>(
    'SELECT id, brand_id, period, kind, body, sort_order FROM ads_reports.brand_notes ORDER BY sort_order, id',
  );
  const notesByBrand = new Map<number, NoteRow[]>();
  for (const n of notes) {
    const list = notesByBrand.get(n.brand_id) ?? [];
    list.push(n);
    notesByBrand.set(n.brand_id, list);
  }
  res.json(
    brands.map((b) => ({
      id: b.brand_id,
      name: b.brand_name,
      category: b.category ?? '',
      description: b.description ?? '',
      updatedAt: b.updated_at,
      notes: (notesByBrand.get(b.brand_id) ?? []).map(shapeNote),
    })),
  );
});

// ── Create a brand (+ empty profile) ────────────────────────────────
brandsRouter.post('/', async (req, res) => {
  const name = str(req.body?.name, 200);
  if (!name) {
    res.status(400).json({ error: 'Nama brand wajib diisi.' });
    return;
  }
  const category = str(req.body?.category, 200);
  const description = str(req.body?.description);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ brand_id: number }>('INSERT INTO public.brands (brand_name) VALUES ($1) RETURNING brand_id', [name]);
    const brandId = rows[0].brand_id;
    await client.query('INSERT INTO ads_reports.brand_profiles (brand_id, category, description) VALUES ($1, $2, $3)', [brandId, category, description]);
    await client.query('COMMIT');
    res.status(201).json({ id: brandId, name, category, description, updatedAt: new Date().toISOString(), notes: [] });
  } catch (err) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: `Brand "${name}" sudah ada.` });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

// ── Update a brand's name / profile ─────────────────────────────────
brandsRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'id tidak valid.' });
    return;
  }
  const hasName = typeof req.body?.name === 'string';
  const hasCategory = typeof req.body?.category === 'string';
  const hasDescription = typeof req.body?.description === 'string';
  const name = str(req.body?.name, 200);
  if (hasName && !name) {
    res.status(400).json({ error: 'Nama brand tidak boleh kosong.' });
    return;
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (hasName) await client.query('UPDATE public.brands SET brand_name = $1 WHERE brand_id = $2', [name, id]);
    if (hasCategory || hasDescription) {
      await client.query(
        `INSERT INTO ads_reports.brand_profiles (brand_id, category, description, updated_at)
           VALUES ($1, $2, $3, now())
         ON CONFLICT (brand_id) DO UPDATE SET
           category    = CASE WHEN $4 THEN EXCLUDED.category ELSE ads_reports.brand_profiles.category END,
           description = CASE WHEN $5 THEN EXCLUDED.description ELSE ads_reports.brand_profiles.description END,
           updated_at  = now()`,
        [id, str(req.body?.category, 200), str(req.body?.description), hasCategory, hasDescription],
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: `Brand "${name}" sudah ada.` });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

// ── Notes (wins / cons / free notes) ────────────────────────────────
brandsRouter.post('/:id/notes', async (req, res) => {
  const brandId = Number(req.params.id);
  if (!Number.isInteger(brandId)) {
    res.status(400).json({ error: 'id tidak valid.' });
    return;
  }
  const kind = KINDS.has(req.body?.kind) ? req.body.kind : 'note';
  try {
    const { rows } = await pool.query<NoteRow>(
      `INSERT INTO ads_reports.brand_notes (brand_id, period, kind, body, sort_order)
         VALUES ($1, $2, $3, $4, COALESCE((SELECT max(sort_order) + 1 FROM ads_reports.brand_notes WHERE brand_id = $1), 0))
       RETURNING id, brand_id, period, kind, body, sort_order`,
      [brandId, str(req.body?.period, 60), kind, str(req.body?.body)],
    );
    res.status(201).json(shapeNote(rows[0]));
  } catch (err) {
    if ((err as { code?: string }).code === '23503') {
      res.status(404).json({ error: 'Brand tidak ditemukan.' });
      return;
    }
    throw err;
  }
});

brandsRouter.patch('/:id/notes/:noteId', async (req, res) => {
  const brandId = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  if (!Number.isInteger(brandId) || !Number.isInteger(noteId)) {
    res.status(400).json({ error: 'id tidak valid.' });
    return;
  }
  const kind = typeof req.body?.kind === 'string' && KINDS.has(req.body.kind) ? req.body.kind : null;
  const { rows } = await pool.query<NoteRow>(
    `UPDATE ads_reports.brand_notes SET
       period     = COALESCE($3, period),
       kind       = COALESCE($4, kind),
       body       = COALESCE($5, body),
       sort_order = COALESCE($6, sort_order),
       updated_at = now()
     WHERE id = $1 AND brand_id = $2
     RETURNING id, brand_id, period, kind, body, sort_order`,
    [
      noteId,
      brandId,
      typeof req.body?.period === 'string' ? str(req.body.period, 60) : null,
      kind,
      typeof req.body?.body === 'string' ? str(req.body.body) : null,
      typeof req.body?.sortOrder === 'number' ? Math.trunc(req.body.sortOrder) : null,
    ],
  );
  if (!rows[0]) {
    res.status(404).json({ error: 'Catatan tidak ditemukan.' });
    return;
  }
  res.json(shapeNote(rows[0]));
});

brandsRouter.delete('/:id/notes/:noteId', async (req, res) => {
  const brandId = Number(req.params.id);
  const noteId = Number(req.params.noteId);
  if (!Number.isInteger(brandId) || !Number.isInteger(noteId)) {
    res.status(400).json({ error: 'id tidak valid.' });
    return;
  }
  await pool.query('DELETE FROM ads_reports.brand_notes WHERE id = $1 AND brand_id = $2', [noteId, brandId]);
  res.json({ ok: true });
});
