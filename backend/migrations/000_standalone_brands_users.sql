-- =====================================================================
-- STANDALONE BRANDS/USERS
-- This app used to live in the same database as ATLAS (`atlas_FIN`) and
-- reused ATLAS's own public.brands/public.users tables (see 001's header).
-- It now has its own dedicated database (Neon project "Monthly Report
-- Generator"), so it needs its own minimal copies of those two tables for
-- 001's foreign keys to resolve — no other system reads/writes these.
--
-- Only brand_id/brand_name are ever read or written by the app (see
-- src/routes/clients.ts's "Clients" list/create). public.users/created_by
-- is an unused nullable FK column on report_runs — kept here only so that
-- column still resolves; nothing populates it.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.brands (
    brand_id    SERIAL PRIMARY KEY,
    brand_name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.users (
    user_id     SERIAL PRIMARY KEY
);
