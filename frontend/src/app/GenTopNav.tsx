import { type CSSProperties } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ReportIcon } from '../components/ReportIcon';
import { isReportKey, REPORT_NAV, type ReportKey } from './reports';

// The generator's report-type switcher. It used to be a 258px left rail,
// which ate a quarter of the width on every page for a list you touch once
// per session — so it's a horizontal bar now, sticky directly under the site
// header (never overlapping it: it offsets by --nav-h, and the report tab
// bar below offsets by --nav-h + --gen-rail-h in turn).
//
// The five report types come first; Riwayat / Pengaturan Brand are utilities
// and sit after a divider, keeping the primary group at five items.
const PRIMARY: ReportKey[] = ['meta', 'shopee', 'tiktok', 'business', 'summary'];

export function GenTopNav({ badges }: { badges: Record<ReportKey, string> }) {
  const { platform } = useParams();
  const activeKey: ReportKey = isReportKey(platform) ? platform : 'meta';
  const reduce = useReducedMotion();

  const primary = REPORT_NAV.filter((r) => PRIMARY.includes(r.key));
  const utility = REPORT_NAV.filter((r) => !PRIMARY.includes(r.key));

  const item = (r: (typeof REPORT_NAV)[number], i: number) => {
    const active = r.key === activeKey;
    const badge = badges[r.key];
    return (
      <motion.div
        key={r.key}
        className="gen-rail-item"
        initial={reduce ? undefined : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.03 * i, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <NavLink
          to={`/generate/${r.key}`}
          className={`gen-rail-link${active ? ' active' : ''}`}
          style={{ '--gr-accent': r.accent, '--gr-tint': r.tint } as CSSProperties}
          aria-current={active ? 'page' : undefined}
        >
          {active && (
            <motion.span
              className="gen-rail-pill"
              layoutId="gen-rail-pill"
              aria-hidden
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 44, mass: 0.6 }}
            />
          )}
          <span className="gen-rail-ico" aria-hidden>
            <ReportIcon name={r.key} className="gen-rail-ico-svg" />
          </span>
          <span className="gen-rail-label">{r.label}</span>
          {badge && badge !== '—' && (
            <span className={`gen-rail-badge${badge === '✓' ? ' done' : ''}`}>{badge === '✓' ? '' : badge}</span>
          )}
        </NavLink>
      </motion.div>
    );
  };

  return (
    <div className="gen-rail">
      <nav className="gen-rail-inner bleed" aria-label="Jenis laporan">
        {primary.map(item)}
        <span className="gen-rail-sep" aria-hidden />
        {utility.map((r, i) => item(r, primary.length + i))}
      </nav>
    </div>
  );
}
