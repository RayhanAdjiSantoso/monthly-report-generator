import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '../migrations');

async function migrate() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  // Migrations need a direct (non-pooled) connection — Neon's pooled
  // (-pooler) endpoint routes through PgBouncer in transaction mode, which
  // doesn't support the session state a multi-statement migration relies on.
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
  await client.connect();

  try {
    // Bootstrap: a minimal tracking table so re-running this script doesn't
    // try to re-apply a migration whose CREATE TABLE statements aren't
    // themselves idempotent (unlike the CREATE SCHEMA/TYPE guards above them).
    await client.query('CREATE SCHEMA IF NOT EXISTS ads_reports');
    await client.query(`
      CREATE TABLE IF NOT EXISTS ads_reports.schema_migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query('SELECT filename FROM ads_reports.schema_migrations');
    const applied = new Set(rows.map((r) => r.filename));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping ${file} (already applied).`);
        continue;
      }
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO ads_reports.schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Applied ${file}.`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
