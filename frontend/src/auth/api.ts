const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.error) || `Request gagal (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchSession(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/api/auth/session`, { credentials: 'include' });
  const data = await json<{ user: AuthUser | null }>(res);
  return data.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return json<AuthUser>(res);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
}
