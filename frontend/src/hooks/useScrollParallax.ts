import { useEffect, useRef } from 'react';

// Attaches a scroll-linked vertical parallax to an element: it drifts at
// `factor`× the scroll distance (rAF-throttled, transform-only, GPU). No-ops
// under prefers-reduced-motion.
export function useScrollParallax<T extends HTMLElement>(factor = 0.12) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(0, ${window.scrollY * factor}px, 0)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [factor]);

  return ref;
}
