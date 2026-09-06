import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

const navLinkClass = (active: boolean) => `site-nav-link${active ? ' active' : ''}`;

// The persistent chrome around every route: one sticky, translucent site
// header (Apple-style — hairline border, blur, shadow-on-scroll). Logo left,
// the three primary links centered, nothing competing on the right.
export function AppShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const onLogin = path === '/login';
  const onGenerate = path.startsWith('/generate') && path !== '/generate/reports';
  const onReports = path === '/generate/reports';
  // Generator pages use a wider content frame — align the header to it.
  const wideFrame = path.startsWith('/generate');
  // Only the login screen rides transparent now. The home page's masthead is
  // a contained blue band with white page around it, so a transparent header
  // over it would put dark nav text on dark blue.
  const transparentTop = onLogin;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();

  // The login screen owns its own brand lockup and has nothing to navigate
  // to, so it gets no header at all rather than an empty one with a second
  // copy of the logo in it.
  if (onLogin) return <main className="site-main">{children}</main>;

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}${transparentTop ? ' transparent-top' : ''}${wideFrame ? ' wide-frame' : ''}`}>
        {/* The bar is a floating pill rather than a full-width band: it sits on
            the page instead of capping it. The header element itself stays
            transparent and only lays down a soft veil once the page scrolls,
            so content passing underneath is muted rather than cut by an edge. */}
        <div className="site-header-inner bleed">
          <Link to="/" className="site-brand">
            <img src="/mil-logo.png" alt="MIL Digital" className="site-brand-logo" width={40} height={40} />
            <span className="site-brand-name">
              Performance <span className="site-brand-name-thin">Report Generator</span>
            </span>
          </Link>

          <nav className="site-nav">
            {!onLogin && (
              <>
                <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
                  Beranda
                </NavLink>
                <NavLink to="/generate/meta" className={navLinkClass(onGenerate)}>
                  Buat Laporan
                </NavLink>
                <NavLink to="/generate/reports" className={navLinkClass(onReports)}>
                  Riwayat
                </NavLink>
              </>
            )}
          </nav>

          <div className="site-user" ref={menuRef}>
            {loading ? null : onLogin ? null : user ? (
              <>
                <button type="button" className="site-user-btn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} title={user.email ?? undefined}>
                  {initial}
                </button>
                {menuOpen && (
                  <div className="site-user-menu" role="menu">
                    <div className="site-user-email">{user.email}</div>
                    {/* Pengaturan Brand moved to the report rail, next to
                        Summary Overview — a destination hidden in an account
                        menu is a destination nobody finds. */}
                    <button type="button" className="site-user-item danger" role="menuitem" onClick={() => logout()}>
                      Keluar
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Link to="/login" className="btn btn-primary site-login-btn">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>
    </>
  );
}
