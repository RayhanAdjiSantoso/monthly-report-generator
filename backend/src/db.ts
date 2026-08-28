import pg from 'pg';
import { config } from './config.js';

// DATE columns (OID 1082) default to being parsed into JS Date objects at
// local midnight, which then serializes to JSON as a UTC ISO string shifted
// by the local timezone offset (e.g. "2026-05-01" -> "2026-04-30T17:00:00Z"
// in UTC+7) — silently corrupting the date by a day. report_runs' period
// columns are date-only values with no time-of-day meaning, so keep them as
// plain "YYYY-MM-DD" strings instead.
pg.types.setTypeParser(1082, (val: string) => val);

// max: kept low on purpose — this pool is created once per live process
// (Docker: one process total; Vercel Functions with Fluid compute: one per
// warm instance, reused across invocations on that instance, same as
// Docker's "create once at module scope" — Fluid compute does not spin up a
// fresh isolate per request the way classic one-shot Lambda did). Total
// connections to Neon scale with the number of *live instances*, not
// requests, so a small per-instance max avoids exhausting Neon's pooled
// endpoint if several instances happen to be warm at once under load.
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5 });

// Without this, an idle pooled client that Neon drops (compute
// scale-to-zero, a network blip, PgBouncer recycling it) surfaces as an
// unhandled 'error' event on the pool — which crashes the whole process,
// not just that one request. This was already a latent risk before Vercel
// entered the picture; it just matters more now that a crashed instance
// mid-request is worse than a crashed long-lived process a restart policy
// would quietly recover.
pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});
