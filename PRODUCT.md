# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

MIL Digital's performance/ads team. They work the monthly reporting cycle at a
desk on a large screen — focused work, often with the ad platform itself open
in another window. One person handles one client brand at a time.

The team logs in; clients do not. But the **report the tool produces is
client-facing**: it leaves as a PDF that gets sent to, and presented to, the
client. So the tool is internal and the artifact is not.

## Product Purpose

Turn raw monthly ad-platform exports into a finished two-period comparison
report, per client brand, without assembling the numbers by hand.

The team uploads what Meta Ads Reporting, Shopee Seller Center, and TikTok Ads
Manager give them, fills in the few figures no export carries (Total Omzet
Toko, offline/other-channel revenue), and gets a report that compares this
period against the last across every platform plus a combined business and
cross-platform summary.

Success: the report is correct, it explains *why* the numbers moved, and it is
presentable enough to send to the client without rework.

## Positioning

It encodes MIL's own reporting method rather than generic BI output:

- a funnel decomposition — GMV → Transaction → Traffic → Impressions / CTR →
  Conversion Rate → Clicks→ATC and ATC→Purchase → AOV / ABS / AUR;
- a plain-language "symptom" read that names which stage actually moved the
  number and what to do about it;
- splits that keep cost-per metrics honest — per objective on Meta, per ad
  channel on Shopee — so a cost-per figure is never divided by a denominator
  from a different objective or channel.

A neighbouring dashboard shows the metrics. This reproduces the specific
analysis MIL delivers to its clients.

## Operating Context

- Monthly cycle, one client brand at a time; two periods compared per run.
- Inputs are raw exports, not an API: Meta Ads Reporting "Formatted data table
  (.xlsx)"; Shopee Seller Center CSVs (Iklan Produk / Produk Otomatis / Toko /
  Toko-Keyword / Live, Product Overview, Product Performance); TikTok Ads
  Manager campaign .xlsx. Optional Shopee CPAS export on the Meta side.
- Some figures are typed in by hand because no export carries them: Total
  Omzet Toko, and the whole Business Overview channel grid.
- Output leaves as PDF (whole report), PNG (per section), or Excel (the wide
  metric-column tables).
- Runs are saved per client and can be reopened or reused as a period source
  for a later report.
- Brand profiles and monthly notes (winnings / cons) exist to enrich findings.
- Interface language is Indonesian.

## Capabilities and Constraints

- Login-gated; opaque DB-backed sessions. Every report is scoped to a client
  brand.
- Report modules: Meta Ads (Boost / Non-Boost / CPAS, with the Non-Boost lane
  split per campaign objective), Shopee Ads (funnel, per-channel, product
  deep-dive, daily trend), TikTok GMV Max, Business Overview (online + offline
  + other channels), Summary Overview (cross-platform).
- **Report content is exported through html2canvas.** It cannot parse
  `color-mix()`, so any CSS that renders into a PDF or PNG must use plain
  tokens or hex. This has already caused visible export bugs; it is a hard
  constraint on visual work inside `.sec-block` and everything under it.
- **An export must contain every section**, including ones collapsed on
  screen. Anything that hides content has to exempt itself during capture.
- Reach and Frequency are non-additive in Meta's Day-breakdown exports; the
  report withholds them rather than showing a wrong sum.
- Deployed on Vercel; a push to `main` auto-deploys. Local build needs Node
  ≥ 22.12.

## Brand Commitments

- **MIL Digital logo** is required.
- **White and blue** is the binding palette for the product's own chrome.
- **Per-platform accent colours are semantic, not decorative**, and must not
  be repurposed or restyled: Meta blue, Shopee orange, TikTok black, Business
  teal, Summary purple. Likewise the good/bad delta colours (green / red).
  Confirmed binding earlier in this project.
- Copy is Indonesian, in the team's own working register.

## Evidence on Hand

- Real client brands exist in the database (Bartega, Box Are Us, Grounds
  Studio, Maiimi, Onycha, Opus One, and others).
- Real ad exports exist on the team's machines but are **deliberately not in
  the repository** — `data/`, `*.xlsx`, `*.csv` are gitignored because they
  carry real campaign performance numbers.
- Logo asset: `frontend/public/mil-logo.png`.
- There are no testimonials, case studies, benchmarks, pricing, or customer
  claims of any kind. This is an internal tool; future work must not invent
  them. Placeholder figures were removed from the page header illustration for
  exactly this reason — on a reporting tool, an invented number reads as data.

## Product Principles

1. **Correctness is the product.** A figure whose source is ambiguous is worse
   than no figure. Never render a number the user cannot trace to a file they
   uploaded or a value they typed.
2. **Explain the movement, not just the delta.** Every change should be
   traceable to the stage that caused it — that is what the client is paying
   for.
3. **Scope every cost-per metric to the spend that produced it.** Blending
   objectives or channels into one denominator yields a confidently wrong
   number.
4. **The screen and the exported PDF are one deliverable.** Anything that
   cannot survive export is not shippable.
5. **The operator is an expert under time pressure.** Density and scanability
   beat decoration; the client-facing artifact is where polish is spent.
