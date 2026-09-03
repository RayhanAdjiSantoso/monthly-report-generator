import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Reveal } from '../../components/Reveal';
import { addNote, createBrand, deleteNote, getBrands, updateBrand, updateNote, type Brand, type BrandNote, type BrandNoteKind } from './api';

const KIND_META: Record<BrandNoteKind, { label: string; cls: string }> = {
  win: { label: 'Winning', cls: 'bn-win' },
  con: { label: 'Kendala', cls: 'bn-con' },
  note: { label: 'Catatan', cls: 'bn-note' },
};

export function BrandSettingsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    getBrands()
      .then(setBrands)
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = useMemo(() => {
    if (!brands) return [];
    const q = query.trim().toLowerCase();
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)) : brands;
  }, [brands, query]);

  function patchBrand(id: number, patch: Partial<Brand>) {
    setBrands((prev) => (prev ? prev.map((b) => (b.id === id ? { ...b, ...patch } : b)) : prev));
  }

  async function handleAdd(name: string) {
    const created = await createBrand({ name });
    setBrands((prev) => (prev ? [...prev, created].sort((a, b) => a.name.localeCompare(b.name)) : [created]));
    setOpenId(created.id);
  }

  return (
    <div className="brand-page">
      <Reveal className="brand-intro">
        Setiap brand punya karakter & histori yang beda. Isi identitas, deskripsi perilaku, dan catatan bulanan (winning / kendala) di sini —
        data ini nanti ikut memperkaya <strong>findings</strong> laporan, bukan cuma angka periode berjalan.
      </Reveal>

      <div className="brand-toolbar">
        <AddBrandForm onAdd={handleAdd} />
        <input className="brand-search" placeholder="Cari brand…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <div className="inline-notice error" style={{ marginTop: '1rem' }}><div className="inline-notice-icon">⚠</div><div>{error}</div></div>}

      {!brands ? (
        <div className="brand-skeleton">
          <span /><span /><span />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-note" style={{ padding: '2rem 0' }}>
          {query ? `Tidak ada brand cocok "${query}".` : 'Belum ada brand. Tambahkan brand pertama di atas.'}
        </div>
      ) : (
        <div className="brand-list">
          {filtered.map((b, i) => (
            <Reveal key={b.id} delay={i * 45}>
              <BrandCard brand={b} open={openId === b.id} onToggle={() => setOpenId((id) => (id === b.id ? null : b.id))} onPatch={(p) => patchBrand(b.id, p)} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function AddBrandForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(n);
      setName('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="brand-add" onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama brand baru" aria-label="Nama brand baru" />
      <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? 'Menambah…' : '+ Tambah Brand'}
      </button>
      {err && <span className="brand-add-err">{err}</span>}
    </form>
  );
}

function BrandCard({ brand, open, onToggle, onPatch }: { brand: Brand; open: boolean; onToggle: () => void; onPatch: (p: Partial<Brand>) => void }) {
  const [name, setName] = useState(brand.name);
  const [category, setCategory] = useState(brand.category);
  const [description, setDescription] = useState(brand.description);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savedTimer = useRef<number | undefined>(undefined);

  const dirty = name.trim() !== brand.name || category !== brand.category || description !== brand.description;

  async function save() {
    if (!name.trim()) return;
    setSaveState('saving');
    try {
      await updateBrand(brand.id, { name: name.trim(), category, description });
      onPatch({ name: name.trim(), category, description, updatedAt: new Date().toISOString() });
      setSaveState('saved');
      window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaveState('idle'), 1800);
    } catch {
      setSaveState('idle');
    }
  }

  const wins = brand.notes.filter((n) => n.kind === 'win').length;
  const cons = brand.notes.filter((n) => n.kind === 'con').length;

  return (
    <div className={`brand-card${open ? ' open' : ''}`}>
      <button type="button" className="brand-card-head" onClick={onToggle} aria-expanded={open}>
        <span className="brand-card-mark" aria-hidden>
          {brand.name.charAt(0).toUpperCase()}
        </span>
        <span className="brand-card-headmain">
          <span className="brand-card-name">{brand.name}</span>
          <span className="brand-card-meta">
            {brand.category && <span className="brand-chip">{brand.category}</span>}
            {wins > 0 && <span className="brand-chip bn-win">{wins} winning</span>}
            {cons > 0 && <span className="brand-chip bn-con">{cons} kendala</span>}
            {!brand.category && wins === 0 && cons === 0 && <span className="brand-card-empty">belum ada detail</span>}
          </span>
        </span>
        <span className="brand-card-chevron" aria-hidden>
          ▾
        </span>
      </button>

      <div className="brand-card-bodywrap">
        <div className="brand-card-body">
          <div className="brand-fields">
            <label className="brand-field">
              <span>Nama brand</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="brand-field">
              <span>Kategori / industri</span>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="cth: Skincare, F&B, Fashion" />
            </label>
          </div>
          <label className="brand-field">
            <span>Deskripsi & perilaku brand</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Positioning, target market, gaya komunikasi, pola musiman, sensitivitas harga, channel yang biasanya kuat, dsb."
            />
          </label>

          <div className="brand-save-row">
            <button type="button" className="btn btn-primary" disabled={!dirty || saveState === 'saving'} onClick={save}>
              {saveState === 'saving' ? 'Menyimpan…' : saveState === 'saved' ? 'Tersimpan ✓' : 'Simpan perubahan'}
            </button>
            {brand.updatedAt && <span className="brand-save-hint">terakhir diubah {new Date(brand.updatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
          </div>

          <NotesEditor brand={brand} onPatch={onPatch} />
        </div>
      </div>
    </div>
  );
}

function NotesEditor({ brand, onPatch }: { brand: Brand; onPatch: (p: Partial<Brand>) => void }) {
  const [period, setPeriod] = useState('');
  const [kind, setKind] = useState<BrandNoteKind>('win');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  function setNotes(notes: BrandNote[]) {
    onPatch({ notes });
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      const note = await addNote(brand.id, { period: period.trim(), kind, body: body.trim() });
      setNotes([...brand.notes, note]);
      setBody('');
      setPeriod('');
    } finally {
      setBusy(false);
    }
  }

  async function edit(noteId: number, patch: Partial<BrandNote>) {
    const updated = await updateNote(brand.id, noteId, patch);
    setNotes(brand.notes.map((n) => (n.id === noteId ? updated : n)));
  }

  async function remove(noteId: number) {
    await deleteNote(brand.id, noteId);
    setNotes(brand.notes.filter((n) => n.id !== noteId));
  }

  return (
    <div className="brand-notes">
      <div className="brand-notes-title">Catatan bulanan · winnings & kendala</div>

      <div className="brand-notes-list">
        {brand.notes.length === 0 && <div className="empty-note" style={{ padding: '.4rem 0' }}>Belum ada catatan. Tambahkan winning atau kendala periode lalu di bawah.</div>}
        {brand.notes.map((n) => (
          <NoteRow key={n.id} note={n} onEdit={(p) => edit(n.id, p)} onRemove={() => remove(n.id)} />
        ))}
      </div>

      <form className="brand-note-add" onSubmit={add}>
        <input className="bn-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Periode (cth: Jul 2026)" />
        <select className="bn-kind" value={kind} onChange={(e) => setKind(e.target.value as BrandNoteKind)}>
          <option value="win">Winning</option>
          <option value="con">Kendala</option>
          <option value="note">Catatan</option>
        </select>
        <input className="bn-body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Deskripsi singkat…" />
        <button type="submit" className="btn btn-ghost" disabled={busy || !body.trim()}>
          {busy ? '…' : 'Tambah'}
        </button>
      </form>
    </div>
  );
}

function NoteRow({ note, onEdit, onRemove }: { note: BrandNote; onEdit: (p: Partial<BrandNote>) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState(note.period);
  const [kind, setKind] = useState<BrandNoteKind>(note.kind);
  const [body, setBody] = useState(note.body);

  if (editing) {
    return (
      <div className="brand-note-row editing">
        <input className="bn-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Periode" />
        <select className="bn-kind" value={kind} onChange={(e) => setKind(e.target.value as BrandNoteKind)}>
          <option value="win">Winning</option>
          <option value="con">Kendala</option>
          <option value="note">Catatan</option>
        </select>
        <input className="bn-body" value={body} onChange={(e) => setBody(e.target.value)} />
        <button
          type="button"
          className="bn-act"
          onClick={() => {
            onEdit({ period: period.trim(), kind, body: body.trim() });
            setEditing(false);
          }}
        >
          ✓
        </button>
        <button type="button" className="bn-act" onClick={() => setEditing(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="brand-note-row">
      <span className={`brand-chip ${KIND_META[note.kind].cls}`}>{KIND_META[note.kind].label}</span>
      {note.period && <span className="bn-period-tag">{note.period}</span>}
      <span className="bn-body-text">{note.body}</span>
      <button type="button" className="bn-act" title="Edit" onClick={() => setEditing(true)}>
        ✎
      </button>
      <button type="button" className="bn-act bn-act-del" title="Hapus" onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
