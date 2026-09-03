import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { pool } from './db.js';

// ── Passwords ── scrypt (built into Node, no native dep), stored as
// `scrypt$<saltHex>$<hashHex>`. Verification is constant-time.
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEYLEN).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, KEYLEN);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// ── Sessions ── opaque random token kept in ads_reports.sessions, sent as an
// httpOnly cookie. No JWT secret to rotate; revoked by deleting the row.
export const SESSION_COOKIE = 'mrg_session';
export const SESSION_DAYS = 30;

export function newSessionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export interface SessionUser {
  id: number;
  email: string;
  name: string | null;
}

export async function resolveSessionUser(req: Request): Promise<SessionUser | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const { rows } = await pool.query<{ id: number; email: string; display_name: string | null }>(
    `SELECT u.id, u.email, u.display_name
       FROM ads_reports.sessions s
       JOIN ads_reports.app_users u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > now()`,
    [token],
  );
  if (!rows[0]) return null;
  return { id: rows[0].id, email: rows[0].email, name: rows[0].display_name };
}

export interface AuthedRequest extends Request {
  user?: SessionUser;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await resolveSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesi tidak valid — silakan login.' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
