import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MilMark } from '../components/MilMark';
import { ReportIcon } from '../components/ReportIcon';
import { REPORT_NAV, type ReportKey } from '../app/reports';
import { useAuth } from './AuthProvider';

// Split screen: the form on the left, an honest description of what is behind
// it on the right. The previous version was one glass card floating on
// blurred orbs and a particle field — decoration standing in for content,
// which is exactly why it read as plain. The right panel is real: the five
// report types the tool actually produces, straight from REPORT_NAV.
const SHOWN: ReportKey[] = ['meta', 'shopee', 'tiktok', 'business', 'summary'];

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in? Skip the form.
  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [loading, user, from, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <MilMark className="login-mark" />

      <div className="login-split">
        <div className="login-panel">
          <a className="login-brand" href="/">
            <img src="/mil-logo.png" alt="MIL Digital" className="login-brand-logo" width={40} height={40} />
            <span className="login-brand-name">
              Performance <span className="login-brand-name-thin">Report Generator</span>
            </span>
          </a>

          <h1 className="login-title">Masuk ke akun Anda</h1>
          <p className="login-sub">Gunakan email MIL Digital Anda.</p>

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
                placeholder="nama@mildigital.id"
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

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
              {busy ? 'Memeriksa…' : 'Masuk'}
            </button>
          </form>

          <p className="login-foot">Belum punya akses? Hubungi admin tim untuk dibuatkan akun.</p>
        </div>

        <aside className="login-aside" aria-label="Jenis laporan yang bisa dibuat">
          <span className="login-aside-title">Yang bisa Anda buat</span>
          <ul className="login-aside-list">
            {SHOWN.map((key) => {
              const r = REPORT_NAV.find((x) => x.key === key)!;
              return (
                <li key={key} className="login-aside-row" style={{ ['--row-accent' as string]: r.accent }}>
                  <span className="login-aside-ico" aria-hidden>
                    <ReportIcon name={r.key} className="login-aside-ico-svg" />
                  </span>
                  <span className="login-aside-text">
                    <span className="login-aside-name">{r.label}</span>
                    <span className="login-aside-tag">{r.tagline}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="login-aside-foot">Dua periode dibandingkan, funnel dibedah, hasilnya siap dikirim ke klien.</p>
        </aside>
      </div>
    </div>
  );
}
