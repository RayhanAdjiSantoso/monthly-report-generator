import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchOption {
  id: number;
  name: string;
}

// A custom, searchable single-select — a white glassy popup with a filter box
// and a keyboard-navigable list, replacing the native <select> whose dropdown
// can't be styled. Closes on outside-click / Escape / pick.
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = '— pilih —',
  searchPlaceholder = 'Cari…',
  emptyLabel = 'Tidak ada hasil',
}: {
  options: SearchOption[];
  value: number | null;
  onChange: (id: number) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.name.toLowerCase().includes(s)) : options;
  }, [options, q]);

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, filtered.findIndex((o) => o.id === value)));
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDoc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (hi < 0) return;
    const el = listRef.current?.children[hi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  function pick(id: number) {
    onChange(id);
    setOpen(false);
    setQ('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = filtered[hi];
      if (o) pick(o.id);
    }
  }

  return (
    <div className={`ssel${open ? ' open' : ''}`} ref={rootRef}>
      <button type="button" className="ssel-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}>
        <span className={selected ? 'ssel-value' : 'ssel-placeholder'}>{selected ? selected.name : placeholder}</span>
        <span className="ssel-caret" aria-hidden>
          ▾
        </span>
      </button>

      {open && (
        <div className="ssel-pop" role="listbox">
          <div className="ssel-search">
            <span className="ssel-search-icon" aria-hidden>
              ⌕
            </span>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHi(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
            />
          </div>
          <div className="ssel-list" ref={listRef}>
            {filtered.length === 0 ? (
              <div className="ssel-empty">{emptyLabel}</div>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  className={`ssel-opt${o.id === value ? ' selected' : ''}${i === hi ? ' hi' : ''}`}
                  onMouseEnter={() => setHi(i)}
                  onClick={() => pick(o.id)}
                >
                  <span className="ssel-opt-name">{o.name}</span>
                  {o.id === value && <span className="ssel-opt-check" aria-hidden>✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
