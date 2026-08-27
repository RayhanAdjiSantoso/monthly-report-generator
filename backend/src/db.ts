import pg from 'pg';
import { config } from './config.js';

// DATE columns (OID 1082) default to being parsed into JS Date objects at
// local midnight, which then serializes to JSON as a UTC ISO string shifted
// by the local timezone offset (e.g. "2026-05-01" -> "2026-04-30T17:00:00Z"
// in UTC+7) — silently corrupting the date by a day. report_runs' period
// columns are date-only values with no time-of-day meaning, so keep them as
// plain "YYYY-MM-DD" strings instead.
pg.types.setTypeParser(1082, (val: string) => val);

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
