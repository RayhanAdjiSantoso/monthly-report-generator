-- =====================================================================
-- ADS REPORTS SCHEMA — Meta Ads / Shopee Ads / TikTok GMV Max
-- Persistence layer for "Performance Report Generator" (Fase 2).
--
-- Originally designed to live in the SAME database as ATLAS (`atlas_FIN`),
-- in its own schema so it never collides with ATLAS's `shopee.*` tables
-- (which model store/order data, a different domain from ad-performance
-- data), reusing ATLAS's existing `public.brands` and `public.users`
-- instead of introducing a parallel `clients`/auth concept.
--
-- This app now has its own dedicated database instead — 000_standalone_
-- brands_users.sql creates minimal standalone versions of those two tables
-- so the foreign keys below still resolve, with no other system involved.
--
-- If report-tool "clients" ever stop being 1:1 with ATLAS "brands" (e.g. one
-- client spans multiple brands), reintroduce a dedicated `clients` table
-- here with a `brand_id` FK instead of referencing `public.brands` directly.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS ads_reports;
SET search_path TO ads_reports, public;

-- ---------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE ads_reports.platform_enum AS ENUM ('meta', 'shopee', 'tiktok');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ads_reports.period_role_enum AS ENUM ('old', 'cur');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =====================================================================
-- SECTION 1 — REPORT RUNS + RAW UPLOAD ARCHIVE
-- =====================================================================

-- One row per "Generate Laporan" click: which brand, which platform, which
-- two periods were compared. Re-uploading the same brand+platform+period
-- combo updates this row (via the UNIQUE constraint) instead of duplicating.
CREATE TABLE ads_reports.report_runs (
    id                  SERIAL PRIMARY KEY,
    brand_id            INTEGER NOT NULL REFERENCES public.brands(brand_id),
    platform            ads_reports.platform_enum NOT NULL,
    period_old_start    DATE,
    period_old_end      DATE,
    period_cur_start    DATE,
    period_cur_end      DATE,
    period_old_label    TEXT,               -- free-form label, not forced to "month name" (Fase 1)
    period_cur_label    TEXT,
    created_by          INTEGER REFERENCES public.users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ux_report_runs_scope UNIQUE (brand_id, platform, period_old_start, period_old_end, period_cur_start, period_cur_end)
);
CREATE INDEX ix_report_runs_brand ON ads_reports.report_runs (brand_id);
CREATE INDEX ix_report_runs_platform ON ads_reports.report_runs (platform);

-- Archived raw upload files (for "open again without re-uploading").
CREATE TABLE ads_reports.raw_uploads (
    id                  SERIAL PRIMARY KEY,
    report_run_id       INTEGER NOT NULL REFERENCES ads_reports.report_runs(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL,      -- 'meta','cpas','produk','produk_otomatis','toko','toko_keyword','live','overview','tiktok'
    period_role         ads_reports.period_role_enum NOT NULL,
    original_filename   TEXT,
    file_period_start   DATE,
    file_period_end     DATE,
    raw_file            BYTEA,              -- MVP: stored inline; move to object storage + path column if volume grows
    uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_raw_uploads_report_run ON ads_reports.raw_uploads (report_run_id);

-- =====================================================================
-- SECTION 2 — PER-PLATFORM AD ROWS (fact tables)
-- Same shape across all three platforms: report_run_id + period_role +
-- channel scope the row, a handful of promoted "core metric" columns cover
-- what every report/insight actually calculates on, and `extra` JSONB
-- catches every other raw column so a new export column never requires a
-- migration.
-- =====================================================================

-- Shopee Ads (Iklan Toko / Iklan Produk / Iklan Produk Otomatis / Iklan Toko
-- - Keyword / Iklan Live — see Fase 3 for the channels beyond Toko/Produk).
CREATE TABLE ads_reports.shopee_ad_rows (
    id                  BIGSERIAL PRIMARY KEY,
    report_run_id       INTEGER NOT NULL REFERENCES ads_reports.report_runs(id) ON DELETE CASCADE,
    period_role         ads_reports.period_role_enum NOT NULL,
    channel             TEXT NOT NULL,      -- 'produk','toko','live','toko_keyword'
    nama_iklan_raw      TEXT,
    nama_iklan_clean    TEXT,               -- after stripping "[n]" suffix + whitespace (Fase 3)
    kode_produk         TEXT,
    category            TEXT,
    series              TEXT,
    kata_pencarian      TEXT,               -- channel = 'toko_keyword' only
    tanggal_mulai       DATE,
    tanggal_selesai     DATE,
    dilihat             NUMERIC,
    jumlah_klik         NUMERIC,
    ctr                 NUMERIC,
    konversi            NUMERIC,
    konversi_langsung   NUMERIC,
    produk_terjual      NUMERIC,
    terjual_langsung    NUMERIC,
    omzet_penjualan     NUMERIC,
    penjualan_langsung  NUMERIC,
    biaya               NUMERIC,
    roas                NUMERIC,
    acos                NUMERIC,
    extra               JSONB,              -- SOV, Modal, Penonton, Tipe Pencocokan, dll
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_shopee_ad_rows_scope ON ads_reports.shopee_ad_rows (report_run_id, channel, period_role);
CREATE INDEX ix_shopee_ad_rows_produk ON ads_reports.shopee_ad_rows (kode_produk);

-- Meta Ads (Boost Post / Non-Boost Post / CPAS Overall / CPAS NV / CPAS RM).
CREATE TABLE ads_reports.meta_ad_rows (
    id                          BIGSERIAL PRIMARY KEY,
    report_run_id               INTEGER NOT NULL REFERENCES ads_reports.report_runs(id) ON DELETE CASCADE,
    period_role                 ads_reports.period_role_enum NOT NULL,
    channel                     TEXT NOT NULL,   -- 'boost','nonboost','cpas_overall','cpas_nv','cpas_rm'
    campaign_name               TEXT,
    month                       TEXT,
    age                         TEXT,
    gender                      TEXT,
    amount_spent                NUMERIC,
    impressions                 NUMERIC,
    clicks                      NUMERIC,
    ctr                         NUMERIC,
    purchases                   NUMERIC,
    purchases_conversion_value  NUMERIC,
    roas                        NUMERIC,
    extra                       JSONB,           -- Profile Visits, ATC, Cost per X, custom conversions, dll
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_meta_ad_rows_scope ON ads_reports.meta_ad_rows (report_run_id, channel, period_role);

-- TikTok GMV Max (campaign-level; no channel split, unlike Meta/Shopee).
CREATE TABLE ads_reports.tiktok_ad_rows (
    id                  BIGSERIAL PRIMARY KEY,
    report_run_id       INTEGER NOT NULL REFERENCES ads_reports.report_runs(id) ON DELETE CASCADE,
    period_role         ads_reports.period_role_enum NOT NULL,
    campaign_name       TEXT,
    cost                NUMERIC,
    sku_orders          NUMERIC,
    gross_revenue       NUMERIC,
    extra               JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_tiktok_ad_rows_scope ON ads_reports.tiktok_ad_rows (report_run_id, period_role);

-- =====================================================================
-- SECTION 3 — LOOKUP + INSIGHT SOURCE TABLES (Fase 3)
-- =====================================================================

-- Category/series lookup, equivalent to the reference spreadsheet's
-- "1. Ref Category Prod" sheet.
CREATE TABLE ads_reports.product_master (
    id                  SERIAL PRIMARY KEY,
    brand_id            INTEGER NOT NULL REFERENCES public.brands(brand_id),
    kode_produk         TEXT,
    nama_produk_clean   TEXT NOT NULL,
    category            TEXT,
    series              TEXT,
    CONSTRAINT ux_product_master UNIQUE (brand_id, nama_produk_clean)
);

-- Shopee Product Overview daily export (store-level, independent of ads).
CREATE TABLE ads_reports.shopee_store_overview_daily (
    id                              BIGSERIAL PRIMARY KEY,
    brand_id                        INTEGER NOT NULL REFERENCES public.brands(brand_id),
    tanggal                         DATE NOT NULL,
    pengunjung_produk               NUMERIC,
    halaman_produk_dilihat          NUMERIC,
    total_pembeli_dibuat            NUMERIC,
    total_penjualan_dibuat          NUMERIC,
    total_pembeli_siap_dikirim      NUMERIC,
    penjualan_siap_dikirim          NUMERIC,
    conversion_rate_siap_dikirim    NUMERIC,
    extra                           JSONB,
    CONSTRAINT ux_shopee_store_overview_daily UNIQUE (brand_id, tanggal)
);

-- Shopee Product Performance export ("Produk dengan Performa Terbaik" sheet).
CREATE TABLE ads_reports.product_performance_snapshot (
    id                              BIGSERIAL PRIMARY KEY,
    brand_id                        INTEGER NOT NULL REFERENCES public.brands(brand_id),
    report_run_id                   INTEGER REFERENCES ads_reports.report_runs(id),
    period_start                    DATE,
    period_end                      DATE,
    kode_produk                     TEXT,
    nama_produk                     TEXT,
    kode_variasi                    TEXT,
    nama_variasi                    TEXT,
    penjualan_dibuat                NUMERIC,
    penjualan_siap_dikirim          NUMERIC,
    produk_dilihat                  NUMERIC,
    produk_diklik                   NUMERIC,
    ctr                             NUMERIC,
    conversion_rate_siap_dikirim    NUMERIC,
    extra                           JSONB
);
CREATE INDEX ix_product_performance_snapshot_brand ON ads_reports.product_performance_snapshot (brand_id);
