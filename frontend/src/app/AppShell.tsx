import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';

const navLinkClass = (active: boolean) => `site-nav-link${active ? ' active' : ''}`;

// The persistent chrome around every route: one sticky, translucent site
// header (Apple-style — hairline border, blur, shadow-on-scroll). Logo left,
// the three primary links centered, nothing competing on the right.
export function AppShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const path = location.pathname;
  const onGenerate = path.startsWith('/generate') && path !== '/generate/reports';
  const onReports = path === '/generate/reports';
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
  }, [location.pathname]);

  return (
    <>
      <header className={`site-header${scrolled ? ' scrolled' : ''}${transparentTop ? ' transparent-top' : ''}`}>
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

          <span className="site-header-spacer" aria-hidden />
        </div>
      </header>

      <main className="site-main">{children}</main>
    </>
  );
}
