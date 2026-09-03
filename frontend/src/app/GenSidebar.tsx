import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { isReportKey, REPORT_NAV, reportByKey, type ReportKey } from './reports';

// The generator's left rail. A tinted "pill" indicator glides behind the
// active report (JS measures its offset), the items stagger in on mount, and
// the active row is enlarged + accent-coloured to read as a real highlight.
export function GenSidebar({ badges }: { badges: Record<ReportKey, string> }) {
  const { platform } = useParams();
  const activeKey: ReportKey = isReportKey(platform) ? platform : 'meta';
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [pill, setPill] = useState<{ y: number; h: number; tint: string } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const el = linkRefs.current[activeKey];
      if (!el) return;
      setPill({ y: el.offsetTop, h: el.offsetHeight, tint: reportByKey(activeKey).tint });
    }
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [activeKey]);

  // Fonts loading later can shift row heights — re-measure once ready.
  useEffect(() => {
    const f = (document as Document & { fonts?: FontFaceSet }).fonts;
    f?.ready.then(() => {
      const el = linkRefs.current[activeKey];
      if (el) setPill({ y: el.offsetTop, h: el.offsetHeight, tint: reportByKey(activeKey).tint });
    });
  }, [activeKey]);

  return (
    <aside className="gen-sidebar">
      <div className="gen-sidebar-title">Buat laporan</div>
      <nav className="gen-sidebar-nav">
        {pill && (
          <span
            className="gen-sidebar-pill"
            aria-hidden
            style={{ transform: `translateY(${pill.y}px)`, height: pill.h, background: pill.tint }}
          />
        )}
        {REPORT_NAV.map((r, i) => (
          <NavLink
            key={r.key}
            ref={(el) => {
              linkRefs.current[r.key] = el;
            }}
            to={`/generate/${r.key}`}
            className="gen-sidebar-link"
            style={{ '--gs-i': i, '--gs-accent': r.accent, '--gs-tint': r.tint } as CSSProperties}
          >
            <span className="gen-sidebar-dot" style={{ background: r.accent }} />
            <span className="gen-sidebar-label">{r.label}</span>
            <span className="gen-sidebar-badge">{badges[r.key] ?? '—'}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
