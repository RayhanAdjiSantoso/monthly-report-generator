-- =====================================================================
-- FASE 4 — AUTH + BRAND IDENTITY
--
-- 1. Login: a tiny single-tenant user table + opaque DB-backed sessions
--    (no JWT secret to manage; revocable; survives restarts). Password is
--    scrypt-hashed in the app (src/auth.ts). Seed the first user with
--    `npm run seed:user` after this migration.
--
-- 2. Brand identity & history: a profile (description / behaviour / category)
--    per brand, plus dated "notes" — wins / cons / free notes from prior
--    months. Feeds the report findings later so a summary can lean on brand
--    context + history, not only the current period's numbers.
--
-- Purely additive. public.brands (000) is the brand list; these hang off it.
-- =====================================================================
SET search_path TO ads_reports, public;

-- ── Auth ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads_reports.app_users (
    id            SERIAL PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ads_reports.sessions (
    token      TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES ads_reports.app_users (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON ads_reports.sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON ads_reports.sessions (expires_at);

-- ── Brand identity ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads_reports.brand_profiles (
    brand_id    INTEGER PRIMARY KEY REFERENCES public.brands (brand_id) ON DELETE CASCADE,
    category    TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- kind: 'win' | 'con' | 'note'
CREATE TABLE IF NOT EXISTS ads_reports.brand_notes (
    id         SERIAL PRIMARY KEY,
    brand_id   INTEGER NOT NULL REFERENCES public.brands (brand_id) ON DELETE CASCADE,
    period     TEXT NOT NULL DEFAULT '',
    kind       TEXT NOT NULL DEFAULT 'note',
    body       TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_notes_brand_idx ON ads_reports.brand_notes (brand_id);
