import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

// Hero headline: a fixed lead line that reveals itself word by word on mount,
// then a second line that loops through a set of closing phrases with an
// overlapping crossfade so it never sits still.
const LEAD = 'Laporan performa iklan,';
const PHRASES = [
  'tersusun dalam hitungan detik.',
  'rapi tanpa kerja manual.',
  'lengkap dengan delta antar periode.',
  'siap kirim ke klien hari ini.',
];
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

// `blur` is only safe on solid-colour text — a `filter` on an element with
// background-clip:text renders nothing in Chromium, so the gradient line
// leaves it off.
function StaggerWords({ text, base, step, blur }: { text: string; base: number; step: number; blur?: boolean }) {
  return (
    <>
      {text.split(' ').map((w, i) => (
        <motion.span
          key={i}
          className="hero-word"
          initial={{ opacity: 0, y: '0.5em', ...(blur ? { filter: 'blur(8px)' } : null) }}
          animate={{ opacity: 1, y: 0, ...(blur ? { filter: 'blur(0px)' } : null) }}
          transition={{ delay: base + i * step, duration: 0.55, ease: EASE }}
        >
          {w}
          {' '}
        </motion.span>
      ))}
    </>
  );
}

export function RotatingHeadline() {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIdx((v) => (v + 1) % PHRASES.length), 3800);
    return () => window.clearInterval(id);
  }, [reduce]);

  return (
    <h1 className="home-title" aria-label={`${LEAD} ${PHRASES[0]}`}>
      <span className="hero-line" aria-hidden>
        {reduce ? LEAD : <StaggerWords text={LEAD} base={0.15} step={0.13} blur />}
      </span>

      <span className="hero-line hero-rotor" aria-hidden>
        {reduce ? (
          <span className="hero-rotor-phrase home-title-grad">{PHRASES[0]}</span>
        ) : (
          <AnimatePresence>
            <motion.span
              key={idx}
              className="hero-rotor-phrase home-title-grad"
              initial={{ opacity: 0, y: '0.5em' }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: '-0.5em' }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              {PHRASES[idx]}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
    </h1>
  );
}
