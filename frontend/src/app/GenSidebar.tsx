import { type CSSProperties } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReportIcon } from '../components/ReportIcon';
import { isReportKey, REPORT_NAV, type ReportKey } from './reports';

// The generator's left rail. Each item carries its own line-icon in a
// brand-tinted tile; the active row gets a soft pill highlight that *glides*
// between items via Framer's shared-layout animation (layoutId).
export function GenSidebar({ badges }: { badges: Record<ReportKey, string> }) {
  const { platform } = useParams();
  const activeKey: ReportKey = isReportKey(platform) ? platform : 'meta';
  const reduce = useReducedMotion();

  return (
    <aside className="gen-sidebar">
      <div className="gen-sidebar-title">Buat laporan</div>
      <motion.nav
        className="gen-sidebar-nav"
        initial={reduce ? undefined : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } } }}
      >
        {REPORT_NAV.map((r) => {
          const active = r.key === activeKey;
          return (
            <motion.div
              key={r.key}
              className="gen-sidebar-item"
              variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } } }}
            >
              <NavLink
                to={`/generate/${r.key}`}
                className={`gen-sidebar-link${active ? ' active' : ''}`}
                style={{ '--gs-accent': r.accent, '--gs-tint': r.tint } as CSSProperties}
              >
                <AnimatePresence>
                  {active && (
                    <motion.span
                      className="gen-sidebar-pill"
                      layoutId="gen-sidebar-pill"
                      aria-hidden
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 42, mass: 0.7 }}
                    />
                  )}
                </AnimatePresence>
                <span className="gen-sidebar-ico" aria-hidden>
                  <ReportIcon name={r.key} className="gen-sidebar-ico-svg" />
                </span>
                <span className="gen-sidebar-label">{r.label}</span>
                <span className="gen-sidebar-badge">{badges[r.key] ?? '—'}</span>
              </NavLink>
            </motion.div>
          );
        })}
      </motion.nav>
    </aside>
  );
}
