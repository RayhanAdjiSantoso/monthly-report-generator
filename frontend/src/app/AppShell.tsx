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
  const { user, logout } = useAuth();
  const location = useLocation();
  const path = location.pathname;
  const onGenerate = path.startsWith('/generate') && path !== '/generate/reports';
  const onReports = path === '/generate/reports';
  // Generator pages use a wider content frame — align the header to it.
  const wideFrame = path.startsWith('/generate');
  // On the home page the header rides transparent over the hero until scroll.
  const transparentTop = path === '/' && !scrolled;

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

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}${transparentTop ? ' transparent-top' : ''}${wideFrame ? ' wide-frame' : ''}`}>
        <div className="site-header-inner bleed">
          <Link to="/" className="site-brand">
            <img src="/mil-logo.png" alt="MIL Digital" className="site-brand-logo" width={40} height={40} />
            <span className="site-brand-name">
              Performance <span className="site-brand-name-thin">Report Generator</span>
            </span>
          </Link>

          <nav className="site-nav">
            <NavLink to="/" end className={({ isActive }) => navLinkClass(isActive)}>
              Beranda
            </NavLink>
            <NavLink to="/generate/meta" className={navLinkClass(onGenerate)}>
              Buat Laporan
            </NavLink>
            <NavLink to="/generate/reports" className={navLinkClass(onReports)}>
              Riwayat
            </NavLink>
          </nav>

          <div className="site-user" ref={menuRef}>
            <button type="button" className="site-user-btn" onClick={() => setMenuOpen((o) => !o)} aria-haspopup="menu" aria-expanded={menuOpen} title={user?.email ?? undefined}>
              {initial}
            </button>
            {menuOpen && (
              <div className="site-user-menu" role="menu">
                <div className="site-user-email">{user?.email}</div>
                <Link to="/generate/brands" className="site-user-item" role="menuitem">
                  Pengaturan Brand
                </Link>
                <button type="button" className="site-user-item danger" role="menuitem" onClick={() => logout()}>
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>
    </>
  );
}
