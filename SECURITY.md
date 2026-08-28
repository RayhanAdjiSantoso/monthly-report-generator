# Security notes

This project moved from a single vanilla-JS `index.html` to a React
frontend (`frontend/`) + Express/Postgres backend (`backend/`). The notes
below describe the current architecture; see git history for the older
vanilla-JS version's own notes if needed.

## Content-Security-Policy

`vercel.json`'s CSP no longer needs `'unsafe-inline'` on `script-src`.
That allowance existed for the old `index.html`'s inline `onclick="..."`
handlers — JSX event handlers (`onClick={...}`) aren't inline HTML
attributes, they're wired up by React itself, so nothing in the built
output needs inline script execution. Verified directly: `frontend/dist/index.html`
loads only external, hashed `<script>`/`<link>` files, no inline `<script>`
blocks.

`style-src` still allows `'unsafe-inline'`, and that's a real, current
need rather than legacy: components across the app use inline
`style={{...}}` (rendered as `style="..."` attributes), which CSP's
`style-src` treats the same way regardless of framework. Removing it would
mean moving every one of those to CSS classes — not done.

What the CSP restricts: scripts/styles only from `'self'` and
`fonts.googleapis.com`/`fonts.gstatic.com`, no framing by another site
(`frame-ancestors 'none'`), and restricted `object-src`/`base-uri`.

## XSS

React escapes all JSX text interpolation (`{value}`) by default — this is
the actual mitigation now, not a manual `escapeHtml()`/`jsAttrEscape()` step
like the old `index.html` needed. Verified: no `dangerouslySetInnerHTML` or
raw `innerHTML` assignment anywhere in `frontend/src`, so nothing in the
app opts out of that default escaping.

## Upload validation

Same protections as before, now living in `frontend/src/lib/validation.ts`
(`validateFileBasics`, `requireColumns`) and `frontend/src/lib/xlsxUtils.ts`
(`requireSheet`): a file is rejected before parsing starts if the extension
isn't `.csv`/`.xlsx`/`.xls`, it's empty or over 20MB, the workbook has no
readable sheet, or the platform's required columns are missing.

## Backend (new — didn't exist in the vanilla-JS version)

- **SQL injection**: every query is parameterized (`$1, $2, ...`), including
  the bulk-insert helper (`backend/src/sqlHelpers.ts`'s `buildBulkInsert`) —
  no string-interpolated SQL anywhere in `backend/src`.
- **CORS**: `CORS_ORIGIN` is env-driven (`backend/src/config.ts`), not
  hardcoded — must be set explicitly per deployment (see `backend/DEPLOY.md`)
  to the actual frontend origin(s); it does not default to allowing
  everything.
- **Secrets**: `backend/.env` (Neon connection strings) is gitignored and
  was never committed — see `backend/.env.example` for the required shape
  with placeholder values only.
