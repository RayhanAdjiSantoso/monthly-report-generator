// One-time helper to seed ads_reports.product_master with a starting-point
// category/series mapping, extracted from a brand's existing manual
// spreadsheet (see seed-data/*.json). Not run automatically by migrate.js —
// entries not covered here (or the reference sheet's own conflicting
// duplicates, dropped during extraction) are meant to be completed via the
// report's inline "Uncategorized" completion form instead.
//
// Usage: node scripts/seed-product-master.js "<Brand Name>" seed-data/product-master-maiimi.json
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  const brandName = process.argv[2];
  const dataFile = process.argv[3];
  if (!brandName || !dataFile) {
    console.error('Usage: node scripts/seed-product-master.js "<Brand Name>" <path-to-seed.json>');
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', dataFile), 'utf8'));

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT brand_id FROM public.brands WHERE brand_name = $1', [brandName]);
    if (!rows.length) {
      console.error(`Brand "${brandName}" not found in public.brands — create it first (e.g. via "+ Klien baru" in the app), then re-run this script.`);
      process.exit(1);
    }
    const brandId = rows[0].brand_id;

    await client.query('BEGIN');
    let count = 0;
    for (const e of entries) {
      await client.query(
        `INSERT INTO ads_reports.product_master (brand_id, nama_produk_clean, category, series)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (brand_id, nama_produk_clean) DO UPDATE SET category = EXCLUDED.category, series = EXCLUDED.series`,
        [brandId, e.namaProdukClean, e.category, e.series],
      );
      count++;
    }
    await client.query('COMMIT');
    console.log(`Seeded ${count} product_master entries for brand "${brandName}" (id ${brandId}).`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
