import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { buildBulkInsert } from '../sqlHelpers.js';
import type { MetaAdRowInput, Platform, RawFileMeta, SaveReportPayload, ShopeeAdRowInput, TiktokAdRowInput } from '../types.js';

export const reportsRouter = Router();

// fieldSize defaults to 1MB in multer, which the JSON `payload` field can
// exceed on large uploads (e.g. a Meta "Day" breakdown export has one row
// per campaign x age x gender x calendar day — thousands of rows, each kept
// verbatim in `extra` — easily well past 1MB once stringified).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, fieldSize: 25 * 1024 * 1024 } });

const PLATFORMS: Platform[] = ['meta', 'shopee', 'tiktok'];

const SHOPEE_COLUMNS = [
  'report_run_id',
  'period_role',
  'channel',
  'nama_iklan_raw',
  'nama_iklan_clean',
  'kode_produk',
  'category',
  'series',
  'kata_pencarian',
  'tanggal_mulai',
  'tanggal_selesai',
  'dilihat',
  'jumlah_klik',
  'ctr',
  'konversi',
  'konversi_langsung',
  'produk_terjual',
  'terjual_langsung',
  'omzet_penjualan',
  'penjualan_langsung',
  'biaya',
  'roas',
  'acos',
  'extra',
];

const META_COLUMNS = [
  'report_run_id',
  'period_role',
  'channel',
  'campaign_name',
  'month',
  'age',
  'gender',
  'amount_spent',
  'impressions',
  'clicks',
  'ctr',
  'purchases',
  'purchases_conversion_value',
  'roas',
  'extra',
];

const TIKTOK_COLUMNS = ['report_run_id', 'period_role', 'campaign_name', 'cost', 'sku_orders', 'gross_revenue', 'extra'];

function toJsonb(v: Record<string, unknown> | null): string | null {
  return v ? JSON.stringify(v) : null;
}

function shopeeRowValues(runId: number, r: ShopeeAdRowInput): unknown[] {
  return [
    runId,
    r.periodRole,
    r.channel,
    r.namaIklanRaw,
    r.namaIklanClean,
    r.kodeProduk,
    r.category,
    r.series,
    r.kataPencarian,
    r.tanggalMulai,
    r.tanggalSelesai,
    r.dilihat,
    r.jumlahKlik,
    r.ctr,
    r.konversi,
    r.konversiLangsung,
    r.produkTerjual,
    r.terjualLangsung,
    r.omzetPenjualan,
    r.penjualanLangsung,
    r.biaya,
    r.roas,
    r.acos,
    toJsonb(r.extra),
  ];
}

function metaRowValues(runId: number, r: MetaAdRowInput): unknown[] {
  return [
    runId,
    r.periodRole,
    r.channel,
    r.campaignName,
    r.month,
    r.age,
    r.gender,
    r.amountSpent,
    r.impressions,
    r.clicks,
    r.ctr,
    r.purchases,
    r.purchasesConversionValue,
    r.roas,
    toJsonb(r.extra),
  ];
}

function tiktokRowValues(runId: number, r: TiktokAdRowInput): unknown[] {
  return [runId, r.periodRole, r.campaignName, r.cost, r.skuOrders, r.grossRevenue, toJsonb(r.extra)];
}

function isValidPayload(body: unknown): body is SaveReportPayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (typeof b.brandId !== 'number') return false;
  if (typeof b.platform !== 'string' || !PLATFORMS.includes(b.platform as Platform)) return false;
  if (!b.period || typeof b.period !== 'object') return false;
  if (!b.rows || typeof b.rows !== 'object') return false;
  return true;
}

reportsRouter.post('/', upload.array('files'), async (req, res) => {
  let payload: unknown;
  try {
    payload = JSON.parse(req.body.payload ?? '');
  } catch {
    res.status(400).json({ error: 'Invalid or missing "payload" field (must be JSON).' });
    return;
  }
  if (!isValidPayload(payload)) {
    res.status(400).json({ error: 'Payload missing required fields: brandId, platform, period, rows.' });
    return;
  }

  let fileMeta: RawFileMeta[] = [];
  if (req.body.fileMeta) {
    try {
      fileMeta = JSON.parse(req.body.fileMeta);
    } catch {
      res.status(400).json({ error: 'Invalid "fileMeta" field (must be JSON array).' });
      return;
    }
  }
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const upsert = await client.query<{ id: number }>(
      `INSERT INTO ads_reports.report_runs
         (brand_id, platform, period_old_start, period_old_end, period_cur_start, period_cur_end, period_old_label, period_cur_label, report_config)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ON CONSTRAINT ux_report_runs_scope
       DO UPDATE SET
         period_old_label = EXCLUDED.period_old_label,
         period_cur_label = EXCLUDED.period_cur_label,
         report_config = EXCLUDED.report_config
       RETURNING id`,
      [
        payload.brandId,
        payload.platform,
        payload.period.oldStart,
        payload.period.oldEnd,
        payload.period.curStart,
        payload.period.curEnd,
        payload.period.oldLabel,
        payload.period.curLabel,
        toJsonb(payload.reportConfig),
      ],
    );
    const runId = upsert.rows[0].id;

    if (payload.platform === 'shopee') {
      await client.query('DELETE FROM ads_reports.shopee_ad_rows WHERE report_run_id = $1', [runId]);
      const insert = buildBulkInsert('ads_reports.shopee_ad_rows', SHOPEE_COLUMNS, (payload.rows.shopee ?? []).map((r) => shopeeRowValues(runId, r)));
      if (insert) await client.query(insert.text, insert.values);
    } else if (payload.platform === 'meta') {
      await client.query('DELETE FROM ads_reports.meta_ad_rows WHERE report_run_id = $1', [runId]);
      const insert = buildBulkInsert('ads_reports.meta_ad_rows', META_COLUMNS, (payload.rows.meta ?? []).map((r) => metaRowValues(runId, r)));
      if (insert) await client.query(insert.text, insert.values);
    } else if (payload.platform === 'tiktok') {
      await client.query('DELETE FROM ads_reports.tiktok_ad_rows WHERE report_run_id = $1', [runId]);
      const insert = buildBulkInsert('ads_reports.tiktok_ad_rows', TIKTOK_COLUMNS, (payload.rows.tiktok ?? []).map((r) => tiktokRowValues(runId, r)));
      if (insert) await client.query(insert.text, insert.values);
    }

    await client.query('DELETE FROM ads_reports.raw_uploads WHERE report_run_id = $1', [runId]);
    for (let i = 0; i < files.length; i++) {
      const meta = fileMeta[i];
      if (!meta) continue;
      await client.query(
        `INSERT INTO ads_reports.raw_uploads (report_run_id, channel, period_role, original_filename, raw_file)
         VALUES ($1, $2, $3, $4, $5)`,
        [runId, meta.channel, meta.periodRole, meta.originalFilename, files[i].buffer],
      );
    }

    await client.query('COMMIT');
    res.json({ id: runId });
  } catch (err) {
    await client.query('ROLLBACK');
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === '23503') {
      res.status(400).json({ error: 'brandId does not reference an existing brand.' });
      return;
    }
    throw err;
  } finally {
    client.release();
  }
});

reportsRouter.get('/', async (req, res) => {
  const clientId = req.query.client_id ? Number(req.query.client_id) : null;
  const platform = typeof req.query.platform === 'string' && req.query.platform ? req.query.platform : null;
  if (!clientId || !Number.isFinite(clientId)) {
    res.status(400).json({ error: 'client_id is required' });
    return;
  }
  const { rows } = await pool.query(
    `SELECT id, platform, period_old_label, period_cur_label, period_old_start, period_old_end, period_cur_start, period_cur_end, created_at
     FROM ads_reports.report_runs
     WHERE brand_id = $1 AND ($2::ads_reports.platform_enum IS NULL OR platform = $2::ads_reports.platform_enum)
     ORDER BY created_at DESC`,
    [clientId, platform],
  );
  res.json(
    rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      periodOldLabel: r.period_old_label,
      periodCurLabel: r.period_cur_label,
      periodOldStart: r.period_old_start,
      periodOldEnd: r.period_old_end,
      periodCurStart: r.period_cur_start,
      periodCurEnd: r.period_cur_end,
      createdAt: r.created_at,
    })),
  );
});

reportsRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const runResult = await pool.query('SELECT * FROM ads_reports.report_runs WHERE id = $1', [id]);
  const run = runResult.rows[0];
  if (!run) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }

  let table: string | null = null;
  if (run.platform === 'shopee') table = 'ads_reports.shopee_ad_rows';
  else if (run.platform === 'meta') table = 'ads_reports.meta_ad_rows';
  else if (run.platform === 'tiktok') table = 'ads_reports.tiktok_ad_rows';

  const rowsResult = table ? await pool.query(`SELECT * FROM ${table} WHERE report_run_id = $1 ORDER BY id`, [id]) : { rows: [] };

  res.json({
    report: {
      id: run.id,
      brandId: run.brand_id,
      platform: run.platform,
      periodOldLabel: run.period_old_label,
      periodCurLabel: run.period_cur_label,
      periodOldStart: run.period_old_start,
      periodOldEnd: run.period_old_end,
      periodCurStart: run.period_cur_start,
      periodCurEnd: run.period_cur_end,
      reportConfig: run.report_config,
      createdAt: run.created_at,
    },
    rows: rowsResult.rows,
  });
});

reportsRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  // Child tables (raw_uploads/shopee_ad_rows/meta_ad_rows/tiktok_ad_rows) all
  // reference report_runs with ON DELETE CASCADE — see 001_ads_reports_schema.sql.
  const result = await pool.query('DELETE FROM ads_reports.report_runs WHERE id = $1', [id]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: 'Report not found' });
    return;
  }
  res.status(204).end();
});
