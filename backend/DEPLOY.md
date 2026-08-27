# Deploy guide — backend

Goal for this setup: the backend runs as one plain Docker image everywhere —
your laptop, a quick host now, your office server later — with no code
changes in between. Only three things ever change across environments:
`DATABASE_URL`, `CORS_ORIGIN`, and where DNS points.

## 0. Prerequisites

- Docker installed locally (to build/test the image before deploying it).
- A [Neon](https://neon.tech) account (Postgres, already decided).

## 1. Create the Neon database — done

Project **Monthly Report Generator** (`fragrant-dawn-46919691`, org
`org-fancy-poetry-50925188`) is already created and linked. `backend/.env`
already has both connection strings Neon gives you for it — the app uses two
different ones on purpose:

```
DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require
DATABASE_URL_UNPOOLED=postgresql://<user>:<password>@<host>.<region>.aws.neon.tech/<db>?sslmode=require&channel_binding=require
```

- **`DATABASE_URL`** (the `-pooler` host) — the app's own `pg.Pool` (`src/db.ts`)
  uses this for normal query traffic. Neon's pooler is PgBouncer in
  transaction mode, which is what you want for a server making many short
  queries.
- **`DATABASE_URL_UNPOOLED`** (no `-pooler`) — `scripts/migrate.js` uses this
  for schema migrations. A pooled/transaction-mode connection doesn't
  support the session state a multi-statement migration relies on, so
  migrations always go through the direct connection instead.

Both already include `?sslmode=require` — `pg` reads that from the
connection string automatically and connects over TLS with no code change
needed. Re-fetch either string anytime with the Neon CLI:

```bash
npx neon@latest connection-string --project-id fragrant-dawn-46919691          # direct
npx neon@latest connection-string --project-id fragrant-dawn-46919691 --pooled # pooled
```

## 2. Run migrations against Neon

Once, from your machine (this only needs `DATABASE_URL_UNPOOLED` in `.env`,
not Docker):

```bash
cd backend
npm ci
npm run migrate
```

This applies every file in `migrations/` in order and records each one in
`ads_reports.schema_migrations`, so re-running it later (e.g. after adding a
new migration file) only applies what's new — safe to run again any time.

**Note on `000_standalone_brands_users.sql`**: `001_ads_reports_schema.sql`
was originally written to share ATLAS's database (`atlas_FIN`) and reuse its
`public.brands`/`public.users` tables. This app now has its own dedicated
Neon database instead, so `000_standalone_brands_users.sql` creates minimal
standalone versions of those two tables first — no ATLAS dependency, no app
code changed. This Neon project starts with an empty client list by design
(confirmed with the team — no existing production data needed migrating).

## 3. Build and test the image locally

```bash
cd backend
docker compose build
docker compose up -d
curl http://localhost:3001/api/health   # -> {"ok":true}
docker compose logs -f                  # watch it, Ctrl+C to stop watching
docker compose down                     # stop it
```

If `curl` doesn't return `{"ok":true}`, check `docker compose logs` first —
almost always a `DATABASE_URL` typo or Neon's IP-allow settings.

## 4. Deploy now (fast path, while you're still on Vercel)

Any host that can "deploy a Dockerfile" works identically here — pick one
based on what's easiest for your team to manage (Railway and Render are
common low-effort choices: point them at this repo's `backend/` directory,
they build the `Dockerfile` and give you a public HTTPS URL). Whichever you
pick, set the same env vars from `backend/.env` in that platform's dashboard
— never commit `.env` itself.

Once it's live, wire the two ends together:

- **Frontend (Vercel)** — set `VITE_API_BASE_URL` to the backend's public
  URL (Vercel → Project Settings → Environment Variables), then redeploy the
  frontend so the build picks it up (`frontend/src/features/reports/api.ts`
  reads it at build time).
- **Backend** — set `CORS_ORIGIN` to your Vercel frontend URL(s), comma-separated
  if there's more than one (e.g. a preview + production URL).

## 5. Later: move to your office domain

Nothing above changes — same Dockerfile, same image, same
`docker-compose.yml`. Only the target machine and DNS change:

1. On the office server: install Docker, copy the `backend/` folder (or pull
   from git), create `.env` there with the same `DATABASE_URL` (still Neon,
   unless you migrate the database itself later — a separate decision).
2. `docker compose up -d` — same command as step 3 above.
3. Put a reverse proxy in front of it (nginx or Caddy) on that server, terminating
   TLS for your domain (Caddy gets you free automatic HTTPS with the least
   config; nginx + `certbot` is the more common alternative) and forwarding to
   `localhost:3001`.
4. Point your domain's DNS at that server.
5. Update `CORS_ORIGIN` to the new domain, and `VITE_API_BASE_URL` on the
   frontend to match, then redeploy the frontend (still on Vercel, or moved
   to the same server serving the built static files — either works, that's
   a separate, later decision that doesn't affect the backend setup above).

## Operational notes

- **Health check**: `GET /api/health` — the Dockerfile's `HEALTHCHECK`
  already polls this every 30s; `docker ps` shows the container as
  `healthy`/`unhealthy` accordingly, and most host platforms use the same
  endpoint for their own uptime checks if you point them at it.
- **Stateless by design**: file uploads are parsed in memory
  (`multer.memoryStorage()`, see `src/routes/reports.ts`) and never written
  to disk — the container has nothing to persist, so it's safe to restart,
  redeploy, or move to a new host at any time with zero data loss risk. All
  actual data lives in Neon.
- **New migrations later**: add a new numbered `.sql` file under
  `migrations/`, rebuild the image (`COPY migrations ./migrations` picks it
  up), and run `npm run migrate` against `DATABASE_URL` once before/after
  deploying the new image — it only applies the new file.
