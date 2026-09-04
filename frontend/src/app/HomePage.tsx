import type { CSSProperties, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ParticleField } from '../components/ParticleField';
import { Reveal } from '../components/Reveal';
import { ReportIcon } from '../components/ReportIcon';
import { RotatingHeadline } from '../components/RotatingHeadline';
import { useScrollParallax } from '../hooks/useScrollParallax';
import { REPORT_NAV, type ReportNavItem } from './reports';

const FLOW = [
  {
    n: '01',
    title: 'Kumpulkan data',
    body: 'Export report dari Meta Ads Reporting, Shopee Seller Center, atau TikTok — satu file yang mencakup dua periode.',
  },
  {
    n: '02',
    title: 'Upload & atur',
    body: 'Pilih klien, upload file, tentukan industri / rentang tanggal / Total Omzet. Data tersimpan bisa dipakai ulang.',
  },
  {
    n: '03',
    title: 'Generate & bagikan',
    body: 'Laporan tersusun otomatis lengkap dengan delta antar periode — unduh sebagai PDF atau PNG per section.',
  },
];

// Pointer-follow highlight + a whisper of tilt (max ±3.5°). Reset on leave.
function trackPointer(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width;
  const py = (e.clientY - r.top) / r.height;
  el.style.setProperty('--mx', `${px * 100}%`);
  el.style.setProperty('--my', `${py * 100}%`);
  el.style.setProperty('--rx', `${(0.5 - py) * 4.5}deg`);
  el.style.setProperty('--ry', `${(px - 0.5) * 4.5}deg`);
}
function resetPointer(e: MouseEvent<HTMLElement>) {
  const el = e.currentTarget;
  el.style.setProperty('--rx', '0deg');
  el.style.setProperty('--ry', '0deg');
}

function HomeCard({ item, delay }: { item: ReportNavItem; delay: number }) {
  return (
    <Reveal delay={delay}>
      <Link
        to={`/generate/${item.key}`}
        className="home-card"
        style={{ '--card-accent': item.accent, '--card-tint': item.tint } as CSSProperties}
        onMouseMove={trackPointer}
        onMouseLeave={resetPointer}
      >
        <span className="home-card-glow" aria-hidden />
        <ReportIcon name={item.key} className="home-card-ghost" />
        <span className="home-card-mark" aria-hidden>
          <ReportIcon name={item.key} className="home-card-mark-svg" />
        </span>
        <span className="home-card-label">{item.label}</span>
        <span className="home-card-tagline">{item.tagline}</span>
        <span className="home-card-desc">{item.desc}</span>
        <span className="home-card-go">
          Buka
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 8h9M8.5 4l4 4-4 4" />
          </svg>
        </span>
      </Link>
    </Reveal>
  );
}

export function HomePage() {
  const watermarkRef = useScrollParallax<HTMLImageElement>(0.14);
  const orbRef = useScrollParallax<HTMLDivElement>(-0.06);

  return (
    <div className="home">
      <section className="home-hero">
        <div className="home-hero-bg" aria-hidden>
          <img ref={watermarkRef} src="/mil-logo.png" alt="" className="home-watermark" />
          <div ref={orbRef} className="home-orbs">
            <span className="orb orb-a" />
            <span className="orb orb-b" />
            <span className="orb orb-c" />
          </div>
          <div className="home-gridlines" />
          <ParticleField className="home-particles" />
          <svg className="home-hero-ring" viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="94" />
            <circle cx="100" cy="100" r="66" />
            <circle cx="100" cy="100" r="38" />
          </svg>
        </div>

        <div className="home-hero-inner bleed">
          <div className="home-hero-copy">
            <p className="home-eyebrow hero-reveal" style={{ '--hr-y': '10px' } as CSSProperties}>
              MIL Digital · Performance Reporting
            </p>
            <RotatingHeadline />
            <p className="home-lede hero-reveal" style={{ '--hr-y': '15px', '--hr-delay': '700ms' } as CSSProperties}>
              Satu tempat untuk merangkum Meta Ads, Shopee Ads, dan TikTok GMV Max — perbandingan antar periode, deep-dive per produk,
              hingga ringkasan bisnis menyeluruh.
            </p>
            <div className="home-cta-row hero-reveal" style={{ '--hr-y': '10px', '--hr-s': '.97', '--hr-delay': '850ms' } as CSSProperties}>
              <Link to="/generate/meta" className="btn btn-primary home-cta-lg">
                Mulai buat laporan
              </Link>
              <Link to="/generate/reports" className="btn btn-ghost home-cta-lg">
                Buka riwayat laporan
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section bleed">
        <Reveal className="home-section-head">
          <h2 className="home-h2">Pilih jenis laporan</h2>
          <p className="home-sub">Setiap jenis punya halamannya sendiri — buka lewat kartu di bawah atau menu di atas.</p>
        </Reveal>
        <div className="home-grid">
          {REPORT_NAV.map((r, i) => (
            <HomeCard key={r.key} item={r} delay={i * 60} />
          ))}
        </div>
      </section>

      <section className="home-section home-section-flow bleed">
        <Reveal className="home-section-head">
          <h2 className="home-h2">Cara kerjanya</h2>
          <p className="home-sub">Tiga langkah, dari file mentah ke laporan siap kirim.</p>
        </Reveal>
        <div className="home-flow">
          {FLOW.map((s, i) => (
            <Reveal key={s.n} delay={i * 90} className="home-flow-item">
              <span className="home-flow-n">{s.n}</span>
              <h3 className="home-flow-title">{s.title}</h3>
              <p className="home-flow-body">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="home-closing bleed">
        <Reveal className="home-closing-inner">
          <span className="home-closing-glow" aria-hidden />
          <h2 className="home-h2">Siap membuat laporan bulan ini?</h2>
          <Link to="/generate/meta" className="btn btn-primary home-cta-lg">
            Mulai sekarang
          </Link>
        </Reveal>
      </section>

      <footer className="home-footer">
        <span>MIL Digital · Performance Report Generator</span>
      </footer>
    </div>
  );
}
