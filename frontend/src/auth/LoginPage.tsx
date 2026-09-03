import { useState, type FormEvent } from 'react';
import { ParticleField } from '../components/ParticleField';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-bg" aria-hidden>
        <img src="/mil-logo.png" alt="" className="login-watermark" />
        <span className="orb orb-a" />
        <span className="orb orb-b" />
        <ParticleField className="login-particles" />
      </div>

      <div className="login-card">
        <img src="/mil-logo.png" alt="MIL Digital" className="login-logo" width={52} height={52} />
        <h1 className="login-title">Masuk</h1>
        <p className="login-sub">Performance Report Generator — MIL Digital</p>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@mil.digital.id"
            />
          </label>
          <label className="login-field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
