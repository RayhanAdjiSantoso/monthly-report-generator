import { Router } from 'express';
import { pool } from '../db.js';

export const clientsRouter = Router();

// "Clients" in this app map 1:1 to ATLAS's existing public.brands table — see
// migrations/001_ads_reports_schema.sql's header comment.
clientsRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<{ brand_id: number; brand_name: string }>('SELECT brand_id, brand_name FROM public.brands ORDER BY brand_name');
  res.json(rows.map((r) => ({ id: r.brand_id, name: r.brand_name })));
});

// Lets this app onboard a brand that doesn't exist in ATLAS yet, instead of
// blocking the user until someone adds it there first. Inserts into the same
// public.brands table ATLAS itself owns/reads — brand_name is the only
// column ATLAS's schema requires, so this is safe to do from here.
clientsRouter.post('/', async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    const { rows } = await pool.query<{ brand_id: number; brand_name: string }>('INSERT INTO public.brands (brand_name) VALUES ($1) RETURNING brand_id, brand_name', [name]);
    res.status(201).json({ id: rows[0].brand_id, name: rows[0].brand_name });
  } catch (err) {
    const pgErr = err as { code?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({ error: `Klien "${name}" sudah ada.` });
      return;
    }
    throw err;
  }
});
