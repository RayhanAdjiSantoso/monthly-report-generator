import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { authRouter } from './routes/auth.js';
import { brandsRouter } from './routes/brands.js';
import { clientsRouter } from './routes/clients.js';
import { productMasterRouter } from './routes/productMaster.js';
import { reportsRouter } from './routes/reports.js';
import { savedPeriodsRouter } from './routes/savedPeriods.js';

// Exported so /api/index.ts (the Vercel adapter, repo root) can import this
// exact app instead of duplicating route setup. Everything below is
// unchanged from the plain-Express version — nothing here is Vercel-aware.
export const app = express();

// credentials:true so the session cookie is allowed on cross-origin setups
// (a separate-origin backend). Same-origin (local vite proxy, Vercel rewrite)
// doesn't need it, but it's harmless there.
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Auth endpoints are open; everything else requires a valid session.
app.use('/api/auth', authRouter);
app.use('/api/clients', requireAuth, clientsRouter);
app.use('/api/reports', requireAuth, reportsRouter);
app.use('/api/saved-periods', requireAuth, savedPeriodsRouter);
app.use('/api/product-master', requireAuth, productMasterRouter);
app.use('/api/brands', requireAuth, brandsRouter);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message });
});

// Skipped on Vercel: the adapter imports `app` above without ever calling
// this file directly, and Vercel's own runtime (not app.listen) is what
// receives requests for a Function. VERCEL=1 is set automatically by
// Vercel's build/runtime — nothing to configure. Everywhere else (local
// `npm run dev`, the Dockerfile's `node dist/index.js`), this env var is
// unset and the server starts exactly as before.
if (process.env.VERCEL !== '1') {
  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}
