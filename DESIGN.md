---
name: MIL Digital Monthly Report Generator
description: A dense, instrument-grade reporting bench that turns raw ad exports into a client-ready two-period comparison.
colors:
  instrument-blue: "#1e3eb8"
  instrument-blue-lift: "#2f54d4"
  instrument-blue-wash: "#eef1fc"
  instrument-blue-edge: "#b8c5f5"
  instrument-blue-deep: "#142c82"
  signal-cyan: "#00c2e0"
  signal-gold: "#f5a623"
  shopee-orange: "#ee4d2d"
  shopee-orange-lift: "#ff6b4a"
  shopee-orange-wash: "#fff4f2"
  shopee-orange-edge: "#f5b5a7"
  shopee-orange-deep: "#a83417"
  tiktok-ink: "#0a0a0a"
  tiktok-cyan: "#69c9d0"
  tiktok-cyan-wash: "#eafbfc"
  business-teal: "#0d9488"
  business-teal-wash: "#e6f7f5"
  summary-violet: "#7c3aed"
  summary-violet-wash: "#f2ecfe"
  summary-violet-edge: "#cbb6f7"
  gain-green: "#15803d"
  gain-green-wash: "#eefcf2"
  loss-red: "#c81e1e"
  loss-red-wash: "#fef1f0"
  midnight-ink: "#0f1a3a"
  slate-reading-gray: "#5a6a90"
  quiet-gray: "#61708f"
  cold-paper: "#fbfcfe"
  bench-white: "#ffffff"
  bench-gray: "#eef1f7"
  hairline-gray: "#dde2ee"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.85rem, 4vw, 2.85rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.032em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.7rem, 3.2vw, 2.35rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  numeric:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "normal"
    fontFeature: "'tnum' 1, 'lnum' 1"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.62rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.07em"
rounded:
  xs: "5px"
  sm: "8px"
  md: "11px"
  lg: "14px"
  xl: "22px"
  pill: "999px"
spacing:
  hair: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "22px"
  xl: "30px"
  section: "1.8rem"
components:
  button-primary:
    backgroundColor: "{colors.instrument-blue}"
    textColor: "{colors.bench-white}"
    typography: "{typography.body}"
    rounded: "9px"
    padding: "0.65rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.instrument-blue-lift}"
    textColor: "{colors.bench-white}"
  button-ghost:
    backgroundColor: "{colors.bench-white}"
    textColor: "{colors.slate-reading-gray}"
    typography: "{typography.body}"
    rounded: "9px"
    padding: "0.65rem 1.5rem"
  button-ghost-hover:
    backgroundColor: "{colors.bench-gray}"
    textColor: "{colors.instrument-blue}"
  select-trigger:
    backgroundColor: "{colors.bench-white}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.md}"
    padding: "0.55rem 0.8rem"
  select-trigger-open:
    backgroundColor: "{colors.bench-white}"
    textColor: "{colors.instrument-blue}"
  dropzone:
    backgroundColor: "{colors.bench-white}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.lg}"
    padding: "0.85rem 0.95rem"
  dropzone-hover:
    backgroundColor: "{colors.instrument-blue-wash}"
    textColor: "{colors.instrument-blue}"
  section-card:
    backgroundColor: "{colors.bench-white}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.lg}"
  section-heading:
    backgroundColor: "{colors.bench-gray}"
    textColor: "{colors.instrument-blue}"
    typography: "{typography.title}"
    padding: "1rem 1.4rem"
  delta-pill-gain:
    backgroundColor: "{colors.gain-green-wash}"
    textColor: "{colors.gain-green}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.55rem"
  delta-pill-loss:
    backgroundColor: "{colors.loss-red-wash}"
    textColor: "{colors.loss-red}"
    rounded: "{rounded.pill}"
    padding: "0.2rem 0.55rem"
  nav-rail-link:
    backgroundColor: "transparent"
    textColor: "{colors.slate-reading-gray}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.8rem"
    height: "58px"
  nav-rail-link-active:
    backgroundColor: "{colors.instrument-blue-wash}"
    textColor: "{colors.instrument-blue}"
---

# Design System: MIL Digital Monthly Report Generator

## Overview

**Creative North Star: "The Analyst's Bench"**

This is a precision instrument laid out on a working surface, not a dashboard
built to impress. The person using it is an expert under time pressure: they
already know what ROAS means, they have the ad platform open in another
window, and they are looking for the one figure that moved. Every pixel is
answerable to that. Density beats decoration; a table that fits more rows on
screen is a better table. Chrome is thin and the content is thick.

The character is precise with a modern edge. Surfaces are white and cold-paper
pale, rules are hairline, type is tight and heavily weighted. But the bench is
not static: the report-type rail carries a gliding highlight between reports,
the symptom tree draws its own branches on open, sections expand on a single
easing curve, and dropdowns land rather than appear. Motion is always a
consequence of an action the user took — nothing loops, nothing floats, and
nothing animates that a reader might be trying to read. The anti-reference is
the dark glowing SaaS dashboard: no neon, no gradients as background, no
decorative charts, and above all no invented figures. On a reporting tool an
ornamental number reads as data, so it is a lie.

The second audience is invisible but decisive. The screen is not the end of
the pipeline — `.sec-block` and everything inside it get captured by
html2canvas and leave as a client-facing PDF. That splits the system in two:
report content is conservative, export-safe, and printable, while the chrome
around it (home page, header, rail, upload cards) may use the modern CSS the
report cannot afford. The split is a rule, not a preference.

**Key Characteristics:**

- One typeface (Inter) doing every job; numbers differentiate through tabular
  lining figures, never through a second family.
- A cold near-white ground (`#fbfcfe`) with white cards and hairline
  `#dde2ee` rules — the palette is quiet so the delta pills can shout.
- Instrument blue owns every control the operator acts on; the platform owns
  every surface that says whose data this is.
- Layered elevation with real meaning: page → panel → card → open card →
  popup, each a step closer to the reader.
- Tight, high-weight type (600–800) at small sizes; hierarchy comes from
  weight and letter-spacing, not from size jumps.
- Motion on one curve (`cubic-bezier(.22,1,.36,1)`), 160–420ms, and fully
  surrendered under `prefers-reduced-motion`.

## Colors

A cold, low-saturation ground of paper-whites and blue-greys, punctuated by
one saturated accent at a time — either the interface's own blue or the
platform whose data is on screen — plus a strictly reserved green/red pair
that never means anything but "better" and "worse".

### Primary

- **Deep Instrument Blue** (`#1e3eb8`): the resting voice of the product.
  Primary buttons, active navigation, focus rings, table-header underlines,
  loaded dropzones, links, and the default `.sec-heading` label. It is also
  Meta's platform colour — see The Home Colour Rule below for why that is not
  a collision.
- **Lifted Instrument Blue** (`#2f54d4`): the second stop of every primary
  gradient (`135deg` on buttons, `180deg` on heading strips) and the hover
  state of the primary button. Never used alone as a flat fill.
- **Instrument Wash** (`#eef1fc`): the tint behind an active rail item, a
  hovered table row, a dropzone icon at rest. This is what "selected" looks
  like when a saturated fill would be too loud.
- **Instrument Edge** (`#b8c5f5`): the 2px underline under a table's header
  row and the hover border on a closed select. A hint of the accent, not the
  accent.
- **Deep Instrument** (`#142c82`): reserved for text that must clear AA on an
  instrument-wash background.

### Secondary — platform identity

These five are semantic, not decorative. Each one *is* the platform; they are
never swapped, tinted for variety, or borrowed for an unrelated element.

- **Shopee Orange** (`#ee4d2d`), with **Lift** (`#ff6b4a`), **Wash**
  (`#fff4f2`), **Edge** (`#f5b5a7`), **Deep** (`#a83417`): the whole Shopee
  report — heading strip, rail icon, symptom-tree root, table hover, and the
  Shopee rail tint.
- **TikTok Ink** (`#0a0a0a`) with **TikTok Cyan** (`#69c9d0`) and **Wash**
  (`#eafbfc`): TikTok GMV Max. The near-black is the identity; the cyan is the
  gradient partner on the heading strip.
- **Business Teal** (`#0d9488`) with **Wash** (`#e6f7f5`): Business Overview,
  the section that mixes online, offline, and other channels.
- **Summary Violet** (`#7c3aed`) with **Wash** (`#f2ecfe`) and **Edge**
  (`#cbb6f7`): the cross-platform Summary Overview.

### Tertiary — accents

- **Signal Cyan** (`#00c2e0`): the far end of heading and hero gradients, and
  the drag-active state on a dropzone. Never a text colour.
- **Signal Gold** (`#f5a623`): held in reserve for warning and attention
  states only. It is deliberately absent from upload surfaces, where a warm
  colour reads as an error the user has not made.

### Neutral

- **Cold Paper** (`#fbfcfe`): the page ground, with two barely-visible washes
  layered on top of it — a radial `#f3f6fc` bloom at the top and a vertical
  `#fcfdff → #f7f9fd` fall, both fixed so the page has depth without a
  pattern.
- **Bench White** (`#ffffff`): every card, panel, table, and popup surface.
- **Bench Gray** (`#eef1f7`): the recessed tone — table headers, section
  heading bands, the symptom-tree panel, chip backgrounds, group dividers.
  This is the workhorse of tonal depth.
- **Hairline Gray** (`#dde2ee`): every border and divider in the system, at
  1px in report content and 1.5px on interactive controls.
- **Midnight Ink** (`#0f1a3a`): all primary text. A navy-black, never pure
  black, so it sits in the same family as the accent.
- **Slate Reading Gray** (`#5a6a90`): secondary text, table header labels,
  inactive navigation, metric captions.
- **Quiet Gray** (`#61708f`): tertiary text only — micro-labels, placeholders,
  helper lines, the tree's collapsed values. It is only one step lighter than
  Slate, because a third tier light enough to read as a third tier cannot
  clear AA. The tier separates by size and weight; colour only finishes it.

### Semantic — movement

- **Gain Green** (`#15803d`) on **Gain Wash** (`#eefcf2`)
- **Loss Red** (`#c81e1e`) on **Loss Wash** (`#fef1f0`)

Both are the deep end of their hue, not the mid tone, because the delta pill
is small bold text on its own wash: the brighter pair measured 3.11:1 and
4.39:1 there and did not clear AA in the exported PDF.

### Named Rules

**The Identity-vs-Action Rule.** The split is not page against page, it is
surface against control. *Identity surfaces* — the report band, section
headings, table-header underlines, row hover, the symptom-tree root, focus
outlines inside a report — belong to the platform whose data is on screen.
*Action controls* — primary buttons, upload dropzones, the client picker,
the stepper's own chrome — stay instrument blue everywhere, on every
platform. That is why a loaded Shopee dropzone is blue and not orange: a warm
colour on an upload surface reads as an error the operator has not made.
Meta's report looks blue because Meta *is* blue, not because blue leaked in.
Implemented by scoping band and outline tokens on `#report-<platform>` rather
than rescoping `--acc`, which would turn the primary button into an orange
gradient whose light stop puts white at 3.66:1.

**The Two-Signal Rule.** Green and red carry exactly one meaning in this
system: a metric moved for the better or for the worse. They are never used
for success toasts, validation, destructive actions, or category coding. If
something needs to look like an error, it uses gold or a neutral treatment —
never the delta pair, and never inside the upload area at all.

**The Ink-Not-Hue Rule.** A saturated platform hue is a fill, a border and a
tint — not a text colour. Shopee orange as text measures 3.2–3.7:1 at every
size the product uses it, so every orange *word* renders in Shopee Deep
(`#a83417`) while every orange *surface* keeps the full-strength hue. The same
test applies before introducing any new accent as type.

**The Quiet Ground Rule.** No screen paints a saturated background. Ground is
cold paper, surfaces are white, recessed areas are bench gray. All saturation
in the system belongs to controls, deltas, and platform identity — the things
the eye is meant to land on.

## Typography

**Display Font:** Inter (with `system-ui`, `sans-serif`)
**Body Font:** Inter (same family)
**Label / Numeric Font:** Inter, with `font-variant-numeric: tabular-nums
lining-nums`

**Character:** One neutral grotesque doing every job, pushed hard at both
ends of the weight axis. Headlines run at 800 with aggressive negative
tracking so they read as a compact block rather than a banner; body and table
text run small and tight, because the value on screen is how much fits, not
how comfortably it breathes. Numbers get their distinctiveness from Inter's
own tabular lining figures — there is deliberately no monospace family, not
even the browser's default on `<code>`.

### Hierarchy

- **Display** (800, `clamp(1.85rem, 4vw, 2.85rem)`, 1.12, `-0.032em`): the
  home page headline and section-opening statements. One per screen.
- **Headline** (800, `clamp(1.7rem, 3.2vw, 2.35rem)`, `-0.03em`): the
  generator page title. Sets the working context, then gets out of the way.
- **Title** (800, `1.02rem`, `-0.015em`): `.sec-heading` — the label on every
  report card. Deliberately raised from its original `.88rem` so that a page
  of stacked tables reads as separate documents rather than one scroll.
- **Body** (400–600, `0.85rem`, 1.55): table cells, paragraph copy, option
  rows. The first column of a table runs at 600 so the metric name reads as a
  label rather than as data.
- **Numeric** (600, `0.85rem`, tabular + lining): every figure in the product.
  Never rendered without `.num` or an equivalent `font-variant-numeric`.
- **Label** (800, `0.62–0.67rem`, `0.05–0.08em`, uppercase): table header
  cells, period tags, badges, tree column heads, and the `.dz-tag` on upload
  cards. Uppercase is what makes them read as chrome instead of content.

### Named Rules

**The One Family Rule.** Inter is the only typeface in the system, on screen
and in export. If something needs to look different, change weight, size,
tracking, or numeric variant — never family. `code { font-family: inherit }`
exists precisely to enforce this.

**The Tabular Figures Rule.** Any number a user might compare down a column
carries tabular lining figures. A ROAS that shifts horizontally between rows
is a defect, not a style choice.

**The Weight-Over-Size Rule.** Hierarchy is built from weight (400 → 600 →
650 → 750 → 800) and tracking, because the working screens cannot afford large
type. A heading two steps up in size is usually a heading that should have
been two steps up in weight.

## Layout

The product runs at two densities. The **chrome** — home page, header,
report-type rail, upload area — is wide and airy: content stretches to
`min(1840px, 100vw - 2rem)` with `clamp(14px, 2.4vw, 40px)` of inline padding,
deliberately small so the width is used rather than pooled into a narrow
column. The **report body** is dense: cards stack in a single column with
`1.8rem` between them, and each card's internal padding is `1rem 1.4rem`.

**Two** sticky layers, never three: the site header at `--nav-h: 66px`, and
the report's own tab bar at `top: calc(var(--nav-h) + 10px)`. The report-type
rail sits between them in normal flow and scrolls away — it is a choice you
make once per session, and as a third sticky band it cost 170px of every
viewport while making it genuinely unclear which level you were navigating.
Anything that scrolls a target into view measures the live stack rather than
hardcoding an offset, and subtracts any section that is mid-collapse above the
target. A bar that floats over content is opaque, not translucent.

**Table geometry** is the system's most specific layout decision. In a
comparison table the value columns shrink to their content (`9.5rem`, or
`6.4rem` inside a split) and the label column absorbs all remaining slack, so
the numbers form one tight right-hand block instead of drifting away from
their metric names. Freed width on the right is not left empty: `.sec-split`
gives it to a companion panel — a symptom tree beside its table — on a
`minmax(0, 630px) minmax(0, 1fr)` grid that collapses to a single column below
`1180px`.

Period-pair uploads are the one place where full width is explicitly refused:
two compact cards sit centred with a `16–24px` gap, and a single-file section
caps at `600–700px` and centres rather than stretching.

Breakpoints in use: `1180px` (split panels collapse), `1120px` (header
illustration drops), `920px` (generator head and hero rotor reflow), `820px`
(hero stops reserving height), `760px` / `680px` / `640px` / `620px` /
`560px` (stepper, upload grid, brand chrome, and header controls go
single-column).

### Named Rules

**The Own-Scroller Rule.** `.sec-block` clips at `overflow: hidden`, so any
table that can exceed its card carries its own `.tbl-scroll` / `.fg-scroll`
wrapper. Without one the overflow is not scrolled, it is destroyed — and the
column that falls off the right edge is the delta, which is the report. The
wrapper releases during capture so a PNG still shrink-wraps the full table.

**The Two-Bar Rule.** At most two bands of chrome are sticky at once, and each
declares its offset from the one above it in tokens. A third level of
navigation does not become sticky just because it exists; it scrolls. Any
scroll-into-view measures the stack live — a number typed by hand into a
`scroll-margin` will be wrong the first time the header wraps.

**The One Place Rule.** A destination appears in exactly one navigation level.
Riwayat lived in both the site header and the report rail, and Pengaturan
Brand in both the rail and the account menu; a link that appears twice in two
different levels is worse than a link that appears once.

**The No-Dead-Channel Rule.** A comparison table never spreads its value
columns evenly across the box. Values cluster right, the label column takes
the slack, and if that leaves a gap wider than a column, the gap becomes a
companion panel.

## Elevation & Depth

Elevation is **structural and layered**: a shadow says how close a surface is
to the reader, and the ladder is consistent everywhere. The ground is cold
paper. On it sit recessed bench-gray panels (table headers, the symptom
panel), which read as cut *into* the surface, not floating. Above those are
white cards with a soft ambient shadow. An accordion section that opens gains
a genuinely heavier shadow — it is now the thing you are reading. Popups and
dropdowns sit highest, with a long, dark cast that clearly separates them from
everything they cover. Colour tinting and shadow work together: `--bg` →
`--s2` → `--surface` is the tonal half of the same ladder.

### Shadow Vocabulary

- **Resting card** (`box-shadow: 0 1px 2px rgba(15,26,58,.04), 0 8px 28px
  rgba(15,26,58,.06)`): `--shadow`. Section cards, panels, the default state
  of anything on the page ground.
- **Low ambient** (`box-shadow: 0 1px 2px rgba(15,26,58,.05), 0 3px 10px
  rgba(15,26,58,.04)`): `--shadow-sm`. Small interactive surfaces — upload
  cards at rest, compact controls.
- **Open section** (`box-shadow: 0 2px 6px rgba(15,26,58,.05), 0 16px 40px
  rgba(15,26,58,.09)`): the single expanded accordion card.
- **Feature card** (`box-shadow: 0 1px 2px rgba(15,26,58,.04), 0 14px 34px
  rgba(15,26,58,.06), inset 0 1px 0 rgba(255,255,255,.6)`): the home page's
  platform cards. The inset white top edge is what makes them read as
  physical.
- **Popup** (`box-shadow: 0 16px 44px rgba(15,26,58,.16), 0 2px 8px
  rgba(15,26,58,.05)`): select dropdowns, user menu. The one place the system
  allows a visibly dark cast.
- **Focus ring** (`box-shadow: 0 0 0 3px rgba(30,62,184,.12)`): `--ring`.
  Never a shadow in the depth sense — always the same 3px accent halo,
  regardless of control.
- **Sticky rail lip** (`box-shadow: 0 1px 16px rgba(15,26,58,.045)`): the
  faint spill under the report rail that proves content is passing beneath it.

Every shadow in the system is cast in `rgba(15,26,58, …)` — the ink colour at
low alpha — never neutral black. That is what keeps a white-on-white interface
from turning grey.

### Named Rules

**The Ink Shadow Rule.** Shadows are tinted with the text colour
(`rgba(15,26,58, …)`), never `rgba(0,0,0, …)`. A neutral-black shadow on a
cold-paper ground reads as dirt.

**The One Open Card Rule.** Within a report page exactly one section is
expanded at a time, and it is the only surface wearing the open-section
shadow. Two cards competing at the same elevation is the state the accordion
exists to prevent.

## Shapes

Corners scale with the size of the surface, and the ladder is strict: `5px` on
micro-chrome (badges, chips), `8px` on small controls and inline tags, `9px`
on buttons, `10–11px` on selects and navigation pills, `13–14px` on cards,
panels, dropzones, and popups, and `22px` on the home page's large platform
cards. `999px` is reserved for delta pills and nothing else — a full pill is
the visual signature of "this is a movement, not a value".

Borders do the structural work that shadows do not. Report content uses `1px`
hairline rules; interactive controls use `1.5px` so they read as touchable;
table header underlines use `2px` in the section's accent so a table announces
which platform it belongs to. A dropzone at rest is the one dashed border in
the system, and it becomes solid the moment a file lands — the form itself
reports state.

Two recurring silhouettes define the product. The **section strip**: every
`.sec-heading` carries a `4px × 1.15em` rounded vertical bar in a
platform-coloured `180deg` gradient, the fastest way to tell which platform a
card belongs to. The **branch**: the symptom tree draws `2px` rounded
segments and elbows at an `18px` indent, with each item owning its own
vertical run so the last child truncates cleanly at its elbow instead of
overshooting.

### Named Rules

**The Radius Ladder Rule.** Radius is a function of surface size, not of
taste. If two nested elements share a radius, the inner one is wrong.

**The Pill Reservation Rule.** `border-radius: 999px` means one thing: a
period-over-period delta. Nothing else in the system is fully rounded.

## Components

### Buttons

*Crisp and lightweight — high weight, tight padding, quick to respond.*

- **Shape:** softly rounded (`9px`), inline-flex with an `8px` icon gap, text
  at `.88rem` / 700 / `-0.01em`.
- **Primary:** a `135deg` instrument-blue gradient (`#1e3eb8 → #2f54d4`) on
  white text, `0.65rem 1.5rem` padding, carrying its own accent-tinted shadow
  (`0 2px 8px rgba(30,62,184,.3)`).
- **Hover / Focus:** the gradient shifts toward cyan, the button lifts
  `1px`, and the shadow deepens — all on a `.18s` transition. Disabled drops
  to `50%` opacity and refuses the lift.
- **Ghost:** white surface, `1.5px` hairline border, slate text. On hover the
  border and text both take the accent and the fill goes bench gray. This is
  the default for any action that is not the page's main verb.

### Cards / Containers

*The report card is the atom of this product — one card, one table, one
exportable artifact.*

- **Corner Style:** `14px` (`22px` on the home page's platform cards).
- **Background:** bench white, on a cold-paper ground.
- **Shadow Strategy:** resting card at rest; open-section shadow when expanded
  (see Elevation & Depth). Home cards add the inset white top edge.
- **Border:** `1px` hairline gray, always present — the border separates, the
  shadow only warms.
- **Internal Padding:** `1rem 1.4rem` on the heading band, `0 1.4rem 1.4rem`
  on the body.
- **Heading:** a `180deg` bench-gray wash (`#eef1f7 → #f4f6fb`), the
  platform-coloured `4px` strip on the left, the section label in that
  platform's colour at `1.02rem` / 800, then badges, then export buttons
  pushed right with `margin-left: auto`.

### Inputs / Fields

*Quiet until addressed.*

- **Style:** white fill, `1.5px` hairline border, `8–10px` radius,
  `0.55rem 0.8rem` padding, `.86rem` / 600 text in ink.
- **Hover:** border shifts to instrument edge (`#b8c5f5`) — a hint, not a
  commitment.
- **Focus / Open:** border goes full instrument blue and the `--ring` halo
  appears (`0 0 0 3px rgba(30,62,184,.12)`). Same treatment on every field in
  the product, including the login form.

### Navigation

Three levels exist and each owns one job: the site header says where you are
in the app, the report rail says which report you are building, the report's
tab bar says which part of it you are reading. Only the first and third are
sticky (The Two-Bar Rule), and no destination appears in two of them (The One
Place Rule).

- **Report rail:** an in-flow bar under the site header, `58px` tall,
  horizontally scrollable with its scrollbar hidden, carrying the five report
  types and nothing else. Items are `.855rem` / 640 slate links at
  `0.5rem 0.8rem` with an `11px` radius. It scrolls away with the page.
- **Active:** a single shared highlight pill glides between items (framer-motion
  `layoutId`), tinted to the active platform's wash; the label takes the
  platform colour at weight 750, and the `26px` leading icon tile inverts to a
  solid platform fill with white glyph.
- **Hover (inactive):** label darkens to ink, icon tile borders and text take
  the platform accent. `:focus-visible` gets a `2px` platform outline at
  `2px` offset.
- **Badges:** a `.6rem` / 800 tabular counter in a bench-gray chip; once a
  report is generated it collapses to a `7px` gain-green dot. A dot reads
  cleaner than a glyph at that size.

### Chips / Badges

- **Style:** white or bench-gray fill, `1px` hairline border, `5px` radius,
  `.62–.64rem` / 600, slate text, `0.15rem 0.55rem` padding.
- **State:** badges are informational only. A selected state uses the accent
  wash as fill and the accent as text; it never inverts to a solid fill.

### Delta Pill — signature component

The single most-repeated element in the product and the reason the rest of the
palette is quiet. A fully-rounded (`999px`) tabular-figure pill at 700 weight,
`0.2rem 0.55rem`: gain green on gain wash, loss red on loss wash, or slate on
bench gray when a metric did not move. A `-sm` variant drops to `.72rem` and a
`7px` radius for use inside dense trees. It carries explicit
`print-color-adjust: exact` so the colour survives into the PDF.

### Upload Dropzone — signature component

A horizontal card — icon, then a three-tier text stack, then a row-count chip
— explicitly *not* full-width. At rest: white fill, `1.5px` dashed hairline
border, `14px` radius, low-ambient shadow, and a `2.15rem` circular
instrument-wash icon tile. On hover or drag the border and icon tile both go
solid instrument blue, the icon inverts to white and scales `1.06`, and the
shadow steps up to the resting-card level. Once loaded the border turns solid
and the fill takes a 6% accent tint. The text stack is fixed at three tiers:
an uppercase `.62rem` period tag in quiet gray, a `.8rem` / 650 instruction in
ink, and a `.66rem` sub-line in quiet gray.

### Symptom Tree — signature component

A funnel decomposition drawn as a real tree rather than an indented list.
`2px` rounded segments in `#b9c3d6` at an `18px` indent, where each item owns
its own vertical run — full height normally, truncated at the elbow when it is
the last child — so a branch always closes cleanly. Depth reads through
material, not indentation alone: the root is a tinted, ring-shadowed card in
the platform's wash, depth-1 nodes (the drivers a metric actually decomposes
into) are white cards with hairline borders, and deeper nodes are transparent
rows that surface on hover. On open the tree draws itself — segment grows
down, elbow grows out, node fades in — cascading in document order at `58ms`
per node. It lives in a recessed bench-gray panel beside its table.

### Section Accordion — behavior

One section expanded per report page. Activating a heading collapses whatever
was open, expands the target, and scrolls it to just below the sticky stack.
The heading grows a chevron that rotates through `45°` on open; the card's
`max-height` animates on the standard curve and the clamp is released on
`transitionend`, because these sections hold live tables whose height changes
when a metric is added. During capture the collapse is disabled outright.

The control is a transparent `<button>` laid over the heading and sized to it,
carrying `aria-expanded` and `aria-controls` with its accessible name read off
the heading text — not `role="button"` on the heading, which already contains
the ⬇ PNG / ⬇ Excel buttons and would nest interactive content inside a button
role. The export buttons sit one layer above the overlay and stay reachable.
Tab, Enter and Space all work because the control is a real button.

## Do's and Don'ts

### Do:

- **Do** keep every accent, tint, hover, and heading strip inside a report
  card in the current platform's colour, and keep every control the operator
  acts on instrument blue (The Identity-vs-Action Rule).
- **Do** render a platform hue as text in its deep shade (`--shopee-700`, not
  `--shopee`) and keep the full-strength hue for fills, borders and tints.
- **Do** give any table that can outgrow its card its own `.tbl-scroll`
  wrapper (The Own-Scroller Rule).
- **Do** build a disclosure control as a real `<button>` with `aria-expanded`
  and `aria-controls`. When the region it toggles already contains buttons,
  lay the control over it as a sibling rather than putting `role="button"` on
  a container that wraps them.
- **Do** write report-content CSS in plain tokens or hex only. Everything
  under `.sec-block` renders through html2canvas, which cannot parse
  `color-mix()` and will drop the rule silently.
- **Do** use `color-mix()`, `backdrop-filter`, and 3D transforms freely in the
  chrome — the home page, header, rail, and upload cards never enter a
  capture.
- **Do** exempt anything that hides content from export mode. `body.pdf-export-mode`
  must force collapsed sections open with `max-height: none !important` and
  `overflow: visible !important`; an export missing a section is a broken
  deliverable.
- **Do** cluster value columns to the right at a fixed width and let the label
  column absorb the slack, so the metric name sits next to its numbers.
- **Do** give every figure `font-variant-numeric: tabular-nums lining-nums`.
- **Do** tint shadows with `rgba(15,26,58, …)`, the ink colour, never black.
- **Do** honour `prefers-reduced-motion` on every animation. Every keyframe in
  this system already has a reduce-motion escape; a new one without it is a
  regression.
- **Do** run all easing through `--ease-out` (`cubic-bezier(.22,1,.36,1)`) in
  the 160–420ms band. State changes sit at 160–220ms, layout and reveal at
  260–420ms.
- **Do** measure the sticky stack at runtime (`.gen-rail`, `.report-tabs`,
  `.site-header`) before scrolling anything into view.

### Don't:

- **Don't** put a warm colour on an upload *control* — the dropzone's border,
  icon tile, or loaded state. A warm control there reads as an error the
  operator has not made, which is why loaded Shopee dropzones are blue. The
  section *label* above them may carry the platform's deep hue; the control
  may not.
- **Don't** use gain green or loss red for anything except a period-over-period
  movement (The Two-Signal Rule).
- **Don't** set `width: 100%` on an upload card by default. Period pairs are
  two compact cards centred with a `16–24px` gap; a single-file section caps
  at `600–700px` and centres.
- **Don't** introduce a second typeface, including a monospace for numbers.
  Weight, size, tracking, and numeric variant carry all differentiation.
- **Don't** render a number the user cannot trace to an uploaded file or a
  value they typed. Decorative or placeholder figures were removed from the
  header illustration for exactly this reason — on a reporting tool, an
  invented number reads as data.
- **Don't** apply `filter` to an element using `background-clip: text` — not
  even `blur(0px)`. Chromium renders nothing.
- **Don't** repurpose a platform accent as category coding. Meta blue, Shopee
  orange, TikTok black, Business teal, and Summary violet are semantic and
  binding — Summary violet marking "client metrics" inside a Shopee card was
  exactly this mistake. Groups inside one report separate by role instead:
  the levers wear the platform accent, the outcome reads in ink.
- **Don't** transition `width` or `height` on chrome; animate `transform` and
  `opacity`, and reserve `max-height` for the accordion where it is
  unavoidable.
- **Don't** let two surfaces wear the open-section shadow at once. Exactly one
  card is expanded per report page.
- **Don't** ship a colour pair without measuring it. Small bold text on its own
  wash is the case that fails most often — the delta pill, table headers, and
  micro-labels all missed AA on values that looked fine.
- **Don't** hardcode a `scroll-margin-top` or sticky offset. Read `--nav-h`
  and `--gen-rail-h`, or measure.
