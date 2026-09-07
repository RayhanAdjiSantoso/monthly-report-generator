import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '../components/Reveal';
import { MilMark } from '../components/MilMark';
import { ReportIcon } from '../components/ReportIcon';
import { REPORT_NAV, type ReportKey, type ReportNavItem } from './reports';

// The five things you can actually generate. Riwayat and Pengaturan Brand are
// utilities and sit below, quieter — they are not report types.
const REPORTS: ReportKey[] = ['meta', 'shopee', 'tiktok', 'business', 'summary'];
const UTILITIES: ReportKey[] = ['reports', 'brands'];

const STEPS = [
  {
    title: 'Kumpulkan data',
    body: 'Export dari Meta Ads Reporting, Shopee Seller Center, atau TikTok Ads Manager — mencakup dua periode.',
  },
  {
    title: 'Upload & lengkapi',
    body: 'Pilih klien, upload file, isi angka yang tidak ada di export: Total Omzet Toko dan channel non-online.',
  },
  {
    title: 'Generate & kirim',
    body: 'Laporan tersusun dengan delta antar periode dan pembacaan funnel — unduh PDF utuh atau PNG per section.',
  },
];

function CometStreak() {
  const reduce = useReducedMotion();
  // A single large-radius arc rather than a bezier: the reference's streak is
  // the lit edge of a sphere, and only a near-constant curvature reads that
  // way — a bezier of the same span looks like a ruled diagonal. It starts
  // past the middle so it sweeps the empty right half instead of ruling a
  // line through the paragraph, which on a pale ground it plainly does.
  // preserveAspectRatio="none" lets it stretch with the band.
  const d = 'M 300 520 A 2000 2000 0 0 1 1780 -70';
  return (
    <svg className="home-streak" viewBox="0 0 1600 400" preserveAspectRatio="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id="streak-g" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e3eb8" stopOpacity="0" />
          <stop offset="20%" stopColor="#2f54d4" stopOpacity=".75" />
          <stop offset="48%" stopColor="#5b3fd6" stopOpacity="1" />
          <stop offset="74%" stopColor="#7c3aed" stopOpacity="1" />
          <stop offset="92%" stopColor="#a78bfa" stopOpacity=".8" />
          <stop offset="100%" stopColor="#cbb6f7" stopOpacity="0" />
        </linearGradient>
        <filter id="streak-glow" x="-25%" y="-90%" width="150%" height="280%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="streak-glow-tight" x="-25%" y="-90%" width="150%" height="280%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <path d={d} className="home-streak-halo" stroke="url(#streak-g)" filter="url(#streak-glow)" />
      <path d={d} className="home-streak-inner" stroke="url(#streak-g)" filter="url(#streak-glow-tight)" />
      <motion.path
        d={d}
        className="home-streak-core"
        stroke="url(#streak-g)"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 1.5, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

// Short form of the three steps for the hero card. The full explanation stays
// in the "Cara kerjanya" band below — this is the summary, not a second copy.
const FLOW = [
  { title: 'Kumpulkan data', hint: 'Export dua periode' },
  { title: 'Upload & lengkapi', hint: 'File + Total Omzet' },
  { title: 'Generate & kirim', hint: 'PDF / PNG / Excel' },
];

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h9M8.5 4l4 4-4 4" />
    </svg>
  );
}

// One row per report type. A row, not a card: seven equal-weight cards with an
// icon, a heading and a paragraph is the shape every generated landing page
// takes, and it reads as filler here — this is a launcher for people who know
// the product, so it is built like the report tables they spend the day in.
function IndexRow({ item }: { item: ReportNavItem }) {
  return (
    <Link
      to={`/generate/${item.key}`}
      className="home-row"
      style={{ '--row-accent': item.accent, '--row-tint': item.tint } as CSSProperties}
    >
      <span className="home-row-ico" aria-hidden>
        <ReportIcon name={item.key} className="home-row-ico-svg" />
      </span>
      <span className="home-row-main">
        <span className="home-row-head">
          <span className="home-row-name">{item.label}</span>
          <span className="home-row-tagline">{item.tagline}</span>
        </span>
        <span className="home-row-desc">{item.desc}</span>
      </span>
      <span className="home-row-go" aria-hidden>
        <Arrow />
      </span>
    </Link>
  );
}

export function HomePage() {
  const byKey = (k: ReportKey) => REPORT_NAV.find((r) => r.key === k) as ReportNavItem;

  return (
    <div className="home">
      <section className="home-top bleed">
        {/* The masthead is deliberately the same object the product makes: a
            deep blue band with white type, the geometry of .report-top. The
            front door looks like the artifact. */}
        <Reveal className="home-band">
          <MilMark className="home-band-mark" />
          <CometStreak />

          <div className="home-band-copy">
            <Link to="/generate/shopee" className="home-badge">
              <span className="home-badge-tag">Baru</span>
              <span className="home-badge-text">Product Analysis untuk Shopee</span>
              <Arrow />
            </Link>
            <h1 className="home-band-title">Laporan performa iklan, tersusun dalam hitungan detik.</h1>
            <p className="home-band-lede">
              Meta Ads, Shopee Ads, dan TikTok GMV Max — dua periode dibandingkan, funnel dibedah, ringkasan bisnis dan lintas
              platform ikut tersusun. Siap dikirim ke klien.
            </p>
            <div className="home-band-actions">
              <Link to="/generate/meta" className="btn home-band-cta">
                Mulai buat laporan
              </Link>
              <Link to="/generate/reports" className="btn home-band-cta ghost">
                Buka riwayat laporan
              </Link>
            </div>
          </div>

          <aside className="home-flowcard" aria-label="Alur pembuatan laporan">
            <span className="home-flowcard-title">Alur</span>
            <ol className="home-flowcard-list">
              {FLOW.map((f, i) => (
                <li key={f.title} className="home-flowcard-step">
                  <span className="home-flowcard-dot" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="home-flowcard-text">
                    <span className="home-flowcard-step-title">{f.title}</span>
                    <span className="home-flowcard-hint">{f.hint}</span>
                  </span>
                </li>
              ))}
            </ol>
          </aside>
        </Reveal>
      </section>

      <section className="home-cut home-cut-index">
        <div className="bleed">
        <header className="home-cut-head">
          <h2 className="home-h2">Jenis laporan</h2>
          <p className="home-cut-sub">Lima jenis laporan, masing-masing punya halaman dan alur uploadnya sendiri.</p>
        </header>
        <div className="home-index">
          {REPORTS.map((k, i) => (
            <Reveal key={k} delay={i * 45}>
              <IndexRow item={byKey(k)} />
            </Reveal>
          ))}
        </div>

        <div className="home-utils">
          {UTILITIES.map((k) => {
            const r = byKey(k);
            return (
              <Link key={k} to={`/generate/${k}`} className="home-util">
                <span className="home-util-ico" aria-hidden>
                  <ReportIcon name={r.key} className="home-util-ico-svg" />
                </span>
                <span className="home-util-text">
                  <span className="home-util-name">{r.label}</span>
                  <span className="home-util-desc">{r.tagline}</span>
                </span>
                <Arrow />
              </Link>
            );
          })}
        </div>
        </div>
      </section>

      <section className="home-cut home-cut-steps">
        <div className="bleed">
        <header className="home-cut-head">
          <h2 className="home-h2">Cara kerjanya</h2>
          <p className="home-cut-sub">Dari file mentah sampai laporan siap kirim, tiga langkah.</p>
        </header>
        <ol className="home-steps">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 70}>
              <li className="home-step">
                <h3 className="home-step-title">{s.title}</h3>
                <p className="home-step-body">{s.body}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        </div>
      </section>

      <footer className="home-footer">
        <span>MIL Digital · Performance Report Generator</span>
      </footer>
    </div>
  );
}
