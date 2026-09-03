import { useRef, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReportKey } from '../app/reports';

// Decorative "stacked dashboard cards" for a page header: a summary tile with
// a mini sparkline + donut, layered on a soft glass card. Placeholder data per
// module — purely visual, floats gently, drifts a touch with the cursor.
const DATA: Record<ReportKey, { label: string; value: string; delta: string; spark: number[]; donut: [number, number, number] }> = {
  meta: { label: 'Amount Spent', value: 'Rp 84,2 jt', delta: '+6,4%', spark: [22, 30, 26, 38, 34, 46, 52], donut: [58, 27, 15] },
  shopee: { label: 'Total Omzet', value: 'Rp 128,4 jt', delta: '+12,5%', spark: [18, 24, 22, 33, 40, 37, 49], donut: [64, 24, 12] },
  tiktok: { label: 'GMV Max', value: 'Rp 41,7 jt', delta: '+18,7%', spark: [12, 20, 28, 24, 36, 44, 54], donut: [72, 18, 10] },
  business: { label: 'Revenue', value: 'Rp 512 jt', delta: '+4,9%', spark: [30, 32, 28, 36, 40, 42, 45], donut: [46, 34, 20] },
  summary: { label: 'Cost / Revenue', value: '18,3%', delta: '−2,1%', spark: [40, 36, 38, 30, 28, 24, 22], donut: [40, 35, 25] },
  reports: { label: 'Laporan tersimpan', value: '128', delta: '+9', spark: [10, 14, 20, 26, 30, 38, 44], donut: [55, 30, 15] },
  brands: { label: 'Brand aktif', value: '12', delta: '+2', spark: [6, 10, 12, 18, 22, 28, 33], donut: [50, 30, 20] },
};

function sparkPath(vals: number[], w: number, h: number): string {
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const rng = max - min || 1;
  return vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / rng) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function HeaderIllustration({ report, accent }: { report: ReportKey; accent: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const d = DATA[report];
  const total = d.donut[0] + d.donut[1] + d.donut[2];
  const C = 2 * Math.PI * 15;
  const segs = d.donut.map((v) => (v / total) * C);
  const up = !d.delta.startsWith('−');

  function onMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width / 2) / r.width;
    const dy = (e.clientY - r.top - r.height / 2) / r.height;
    ref.current.style.setProperty('--il-x', `${dx * 8}px`);
    ref.current.style.setProperty('--il-y', `${dy * 8}px`);
  }
  function onLeave() {
    ref.current?.style.setProperty('--il-x', '0px');
    ref.current?.style.setProperty('--il-y', '0px');
  }

  return (
    <div className="hi-wrap" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} aria-hidden style={{ '--hi-accent': accent } as CSSProperties}>
      <motion.div
        className="hi-stack"
        animate={reduce ? undefined : { y: [0, -7, 0] }}
        transition={reduce ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="hi-card hi-card-back" />
        <div className="hi-card hi-card-mid">
          <svg viewBox="0 0 120 40" className="hi-spark" preserveAspectRatio="none">
            <path d={sparkPath(d.spark, 120, 36) + ` L120 40 L0 40 Z`} className="hi-spark-fill" />
            <path d={sparkPath(d.spark, 120, 36)} className="hi-spark-line" />
          </svg>
        </div>
        <div className="hi-card hi-card-front">
          <div className="hi-metric">
            <span className="hi-metric-label">{d.label}</span>
            <span className="hi-metric-value num">{d.value}</span>
            <span className={`hi-metric-delta num ${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'} {d.delta.replace('−', '').replace('+', '')}</span>
          </div>
          <svg viewBox="0 0 40 40" className="hi-donut">
            <circle cx="20" cy="20" r="15" className="hi-donut-track" />
            <circle cx="20" cy="20" r="15" className="hi-donut-seg s1" strokeDasharray={`${segs[0]} ${C}`} />
            <circle cx="20" cy="20" r="15" className="hi-donut-seg s2" strokeDasharray={`${segs[1]} ${C}`} strokeDashoffset={-segs[0]} />
            <circle cx="20" cy="20" r="15" className="hi-donut-seg s3" strokeDasharray={`${segs[2]} ${C}`} strokeDashoffset={-(segs[0] + segs[1])} />
          </svg>
        </div>
      </motion.div>
    </div>
  );
}
