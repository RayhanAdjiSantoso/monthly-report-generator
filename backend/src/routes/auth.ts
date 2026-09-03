import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, newSessionToken, readCookie, requireAuth, resolveSessionUser, SESSION_COOKIE, SESSION_DAYS, verifyPassword, type AuthedRequest } from '../auth.js';

export const authRouter = Router();

const isProd = process.env.VERCEL === '1';

// One-time bootstrap: while there are no users yet, the first login with a
// configured bootstrap email + password creates that account (using whichever
// email was actually typed). Set AUTH_BOOTSTRAP_EMAIL / AUTH_BOOTSTRAP_PASSWORD
// to override.
const BOOTSTRAP_EMAILS = (process.env.AUTH_BOOTSTRAP_EMAIL ? [process.env.AUTH_BOOTSTRAP_EMAIL] : ['jonathan.h@mildigital.id', 'jonathan.h@mil.digital.id']).map((e) =>
  e.trim().toLowerCase(),
);
const BOOTSTRAP_PASSWORD = process.env.AUTH_BOOTSTRAP_PASSWORD ?? 'mildigital';

authRouter.post('/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!email || !password) {
    res.status(400).json({ error: 'Email dan password wajib diisi.' });
    return;
  }

  let { rows } = await pool.query<{ id: number; email: string; password_hash: string; display_name: string | null }>(
    'SELECT id, email, password_hash, display_name FROM ads_reports.app_users WHERE lower(email) = $1',
    [email],
  );

  // Bootstrap the very first account on first successful login.
  if (rows.length === 0) {
    const { rows: countRows } = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM ads_reports.app_users');
    if (countRows[0].n === '0' && BOOTSTRAP_EMAILS.includes(email) && password === BOOTSTRAP_PASSWORD) {
      const inserted = await pool.query<{ id: number; email: string; password_hash: string; display_name: string | null }>(
        'INSERT INTO ads_reports.app_users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, password_hash, display_name',
        [email, hashPassword(password), 'Jonathan'],
      );
      rows = inserted.rows;
    }
  }

  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Email atau password salah.' });
    return;
  }

  const token = newSessionToken();
  await pool.query(
    "INSERT INTO ads_reports.sessions (token, user_id, expires_at) VALUES ($1, $2, now() + ($3 || ' days')::interval)",
    [token, user.id, String(SESSION_DAYS)],
  );
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
  res.json({ id: user.id, email: user.email, name: user.display_name });
});

authRouter.post('/logout', async (req, res) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await pool.query('DELETE FROM ads_reports.sessions WHERE token = $1', [token]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json((req as AuthedRequest).user);
});

// Soft check used by the frontend on boot — 200 with user or null, never 401,
// so it doesn't trip global error UI.
authRouter.get('/session', async (req, res) => {
  const user = await resolveSessionUser(req);
  res.json({ user });
});
