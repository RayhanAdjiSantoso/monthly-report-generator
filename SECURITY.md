# Security notes

## Content-Security-Policy — why `'unsafe-inline'` is there

`vercel.json`'s CSP allows `'unsafe-inline'` for both `script-src` and
`style-src`. This is a deliberate, temporary tradeoff, not an oversight —
`vercel.json` is strict JSON and can't hold a comment explaining it inline,
so it's documented here instead.

**Why it's needed today:** `index.html` uses inline event-handler attributes
throughout (`onclick="switchTab('meta')"`, `onclick="addMetric(...)"`, etc.)
and inline `style="..."` attributes on many elements. A CSP without
`'unsafe-inline'` on `script-src` would block every one of those handlers
from firing — the app would load but nothing would be clickable.

**What removing it would require:** replacing every inline `onclick="..."`
attribute with `addEventListener` calls wired up in JavaScript (e.g. via a
single delegated listener on `#app` keyed off `data-action` attributes), and
moving inline `style="..."` attributes to CSS classes or a nonce-based
`style-src`. This is a real refactor touching most of the render functions
in `index.html` (`renderPicker`, `renderSection`, `demoTable`, `kpiTable`,
`renderOverviewDetailedCard`, `renderSummaryContent`, and more) — intentionally
out of scope for this hardening pass, which focused on fixing the actual
vulnerability (unescaped HTML injection, see below) rather than restructuring
the event-handling architecture.

**What the current CSP still buys you** even with `'unsafe-inline'`: it blocks
loading scripts/styles from any origin other than `cdnjs.cloudflare.com`,
`cdn.sheetjs.com`, and `fonts.googleapis.com`, blocks the page from being framed by another site
(`frame-ancestors 'none'`, clickjacking protection), and restricts
`object-src`/`base-uri`. It does **not** stop inline-script-based XSS by
itself — that protection comes from the escaping fix below.

## XSS fix — the actual mitigation

Every place that inserts a filename, Excel/CSV column header, or a
dimension/cell value (Age/Gender bucket, custom period label, etc.) into the
DOM now goes through `escapeHtml()` (or `jsAttrEscape()` for values embedded
inside an inline `onclick="..."` attribute) before reaching `innerHTML`.
This is the real fix for the stored-XSS risk found in the security audit —
the CSP above is defense-in-depth on top of it, not a substitute for it.

## Upload validation

`validateFileBasics()`, `requireSheet()`, and `requireColumns()` in
`index.html` reject files before parsing starts if the extension isn't
`.csv`/`.xlsx`/`.xls`, the file is empty or over 20MB, the workbook has no
readable sheet, or the required columns for that platform are missing.
