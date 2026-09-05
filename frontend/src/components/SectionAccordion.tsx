import { Children, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// Everything sticky above the report stacks: site header → report-type rail →
// the report's own tab bar. Measure whichever is lowest rather than hardcode a
// number, so opening a section parks it just under the chrome instead of
// behind it.
function stickyBottom(): number {
  const bottoms = ['.gen-rail', '.report-tabs', '.site-header']
    .map((sel) => document.querySelector(sel)?.getBoundingClientRect().bottom ?? 0)
    .filter((n) => n > 0);
  return bottoms.length ? Math.max(...bottoms) : 0;
}

const prefersReduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Collapses a run of report sections into a single-open accordion: clicking a
// section's heading opens it, closes whichever was open, and scrolls it up to
// the top of the reading area — a report is a dozen tall cards, and opening
// the ninth shouldn't leave you looking at the eighth.
//
// Each child renders its own `.sec-block` + `.sec-heading`, so rather than
// re-plumbing every section component this wraps them and animates the block's
// max-height between "heading only" and its measured content height. The
// clamp is dropped once the transition finishes: these sections hold live
// tables whose height changes when you add or remove a metric, and a section
// frozen at its opening height would clip them. Same reason `overflow` is only
// hidden while animating — the metric pickers inside open as popups.
//
// The heading click is caught on the wrapper, with the buttons inside it
// (⬇ PNG / ⬇ Excel) excluded so they still work.
export function SectionAccordion({ children, defaultOpen = 0 }: { children: ReactNode; defaultOpen?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  const [open, setOpen] = useState(defaultOpen);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // Scroll only for a click, never for the initial render.
  const pendingScroll = useRef<number | null>(null);
  const mounted = useRef(false);

  const blockOf = (i: number) => refs.current[i]?.querySelector<HTMLElement>('.sec-block') ?? null;
  const headHeight = (block: HTMLElement) => block.querySelector<HTMLElement>('.sec-heading')?.offsetHeight ?? 56;

  useLayoutEffect(() => {
    items.forEach((_, i) => {
      const block = blockOf(i);
      if (!block) return;
      const isOpen = open === i;
      const head = headHeight(block);

      // First paint: set the collapsed state outright, no transition.
      if (!mounted.current) {
        if (!isOpen) {
          block.style.maxHeight = `${head}px`;
          block.style.overflow = 'hidden';
        }
        return;
      }

      const done = () => {
        block.style.maxHeight = '';
        block.style.overflow = '';
      };

      if (isOpen) {
        if (!block.style.maxHeight) return; // already open
        if (prefersReduced()) return done();
        block.style.overflow = 'hidden';
        block.style.maxHeight = `${block.scrollHeight}px`;
        block.addEventListener('transitionend', function end(e) {
          if (e.propertyName !== 'max-height') return;
          block.removeEventListener('transitionend', end);
          done();
        });
      } else {
        if (block.style.maxHeight === `${head}px`) return; // already closed
        if (prefersReduced()) {
          block.style.maxHeight = `${head}px`;
          block.style.overflow = 'hidden';
          return;
        }
        // Pin the current height first so the transition has somewhere to go.
        block.style.overflow = 'hidden';
        block.style.maxHeight = `${block.scrollHeight}px`;
        void block.offsetHeight;
        block.style.maxHeight = `${head}px`;
      }
    });
    mounted.current = true;
  }, [open, items.length]);

  useEffect(() => {
    const i = pendingScroll.current;
    pendingScroll.current = null;
    if (i === null || i !== open) return;
    const el = refs.current[i];
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - stickyBottom() - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced() ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  return (
    <div className="sec-accordion">
      {items.map((child, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`sec-acc-item${open === i ? ' open' : ''}`}
          onClickCapture={(e) => {
            const el = e.target as HTMLElement;
            // Only the heading toggles — never the export buttons living in it.
            if (!el.closest('.sec-heading') || el.closest('button') || el.closest('a')) return;
            e.preventDefault();
            setOpen((cur) => {
              const next = cur === i ? -1 : i;
              pendingScroll.current = next;
              return next;
            });
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
