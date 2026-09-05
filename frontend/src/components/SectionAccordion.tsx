import { Children, useState, type ReactNode } from 'react';

// Collapses a run of report sections into a single-open accordion: clicking a
// section's heading opens it and closes whichever was open. A Shopee report is
// a dozen tall cards; scrolling past eleven to reach the twelfth is the
// problem this solves.
//
// Each child renders its own `.sec-block` + `.sec-heading`, so rather than
// re-plumbing every section component this wraps them and hides everything
// after the heading via CSS. The heading click is caught on the wrapper —
// with the buttons inside it (⬇ PNG / ⬇ Excel) excluded, so they still work.
export function SectionAccordion({ children, defaultOpen = 0 }: { children: ReactNode; defaultOpen?: number }) {
  const items = Children.toArray(children).filter(Boolean);
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sec-accordion">
      {items.map((child, i) => (
        <div
          key={i}
          className={`sec-acc-item${open === i ? ' open' : ''}`}
          onClickCapture={(e) => {
            const el = e.target as HTMLElement;
            // Only the heading toggles — never the export buttons living in it.
            if (!el.closest('.sec-heading') || el.closest('button') || el.closest('a')) return;
            e.preventDefault();
            setOpen((cur) => (cur === i ? -1 : i));
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
