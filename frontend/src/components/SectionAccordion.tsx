import { Children, useEffect, useRef, useState, type ReactNode } from 'react';

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

// Collapses a run of report sections into a single-open accordion: clicking a
// section's heading opens it, closes whichever was open, and scrolls it up to
// the top of the reading area — a report is a dozen tall cards, and opening
// the ninth shouldn't leave you looking at the eighth.
//
// Each child renders its own `.sec-block` + `.sec-heading`, so rather than
// re-plumbing every section component this wraps them and hides everything
// after the heading via CSS. The heading click is caught on the wrapper —
// with the buttons inside it (⬇ PNG / ⬇ Excel) excluded, so they still work.
export function SectionAccordion({ children, defaultOpen = 0 }: { children: ReactNode; defaultOpen?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  const [open, setOpen] = useState(defaultOpen);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // Only scroll for a click, never for the initial render.
  const pending = useRef<number | null>(null);

  useEffect(() => {
    const i = pending.current;
    pending.current = null;
    if (i === null || i !== open) return;
    const el = refs.current[i];
    if (!el) return;
    // Let the newly expanded content lay out before measuring.
    const raf = requestAnimationFrame(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const top = el.getBoundingClientRect().top + window.scrollY - stickyBottom() - 12;
      window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
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
              pending.current = next;
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
