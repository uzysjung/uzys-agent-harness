# Concept presets — starting values and where they come from

These are **starting values**. Step 3 (calibrate) is expected to change some of them. Copy each value
together with its basis into `DESIGN.md`.

How to read the cells:

- A system name with a token (`Carbon body-01`) = the value published by that design system.
- `measured` = the median of public product screens measured on 2026-11-16 at 375px and 1440px;
  the range is in parentheses, and `n/m` means n of the m measured services did this. Cells with
  only two services (the Korean / global split in commerce) are ranges, not medians.
- `[assumption]` = derived from sourced values, not observed anywhere. Replace it by measurement
  when you can; otherwise keep the label in `DESIGN.md`.
- **Letter-spacing has no preset number.** Tracking belongs to the typeface: at body size Carbon
  (IBM Plex) and Material 3 (Roboto) are positive, SF Pro is negative, Polaris is 0. Choose the
  typeface first, then take its value. Every measured service used `normal` body tracking; non-zero
  values appeared only on headings and prices.

Measurement sample and its limits:

| Concept | Services measured (public, logged-out product screens) |
|---|---|
| SaaS | GitHub (issue list) · GitLab (work item list) · Hugging Face (model list) |
| B2C | Airbnb (search start) · Spotify (playlist) · Daangn/Karrot (second-hand listings) |
| Commerce | Musinsa · 29CM (Korean) · Nike · Allbirds (global) — listing and product detail |

Each service was measured once, in a `ko-KR` browser locale (some sites redirected to their Korean
edition). The SaaS sample leans toward developer tools; dashboard and CRM products were not
measured. Section spacing, B2C reading width, cart and checkout were not measured.

---

## SaaS — business product UI (tables, forms, dashboards)

Primary references: Carbon (productive set) · Polaris (Admin) · SLDS 2 (Cosmos theme) · Astryx defaults.
A seller admin attached to a shop also uses this column.

| Axis | Starting value | Basis |
|---|---|---|
| Body size / line height | 14px / 20px | Carbon `body-01` · Astryx body. Measured 14 / 21 (14–16). SLDS 2 and Polaris use 13px |
| Secondary · label | 12 / 16 · form label 13px weight 600 | Carbon `label-01` · M3 label medium · Polaris `body-sm` · SLDS 2 form label |
| Headings | Component title 14 / 18 weight 600 · screen title 20 / 28 | Carbon `heading-compact-01` · Carbon `heading-03` · Astryx h2. Measured screen title 20 (18–30) |
| Letter-spacing | Set from the typeface | Carbon +0.16px at 14px (IBM Plex) · SF Pro −0.08pt at 13pt · Polaris body 0 · SLDS 2 and Astryx have no tracking token. Measured body `normal` 3/3 |
| Control height | 32px · inputs 30px | Measured 32 (28–32), inputs 28–32 · SLDS 2 32 · Astryx md 32 · shadcn `nova` 32–36 · `mira` 28–32 |
| Radius | 6–8px | shadcn `nova` · Astryx element 8 · SLDS 2 input 8 (its buttons are pills). Measured buttons 4–6 |
| Spacing | 4px grid · between controls 8 · card padding 16 · card gap 16 · table cell padding 6 · two density levels · section gap 16–24 `[assumption]` | Polaris button group, card, table · measured control gap mode 4–8 · SLDS 2 Comfy / Compact · section gap derived from the Carbon spacing scale |
| Separation | Hairlines rather than shadows | shadcn `nova` |
| Layout | Side panel + content; navigation panel 240–256px; collapses to one column at phone width. A fixed panel sits outside the grid; content uses 16 columns from 1056px with a 32px gutter. Fluid content width `[assumption]` | Measured side panel 3/3 · Carbon 2x grid |
| shadcn style | `nova` (dense tables: `mira`; plain: `vega`) | Final choice by the shadcn skill's "Picking a style" table |
| daisyUI theme | `--size-field: 0.21875rem`–`0.25rem` · `--radius-field: 0.25rem`–`0.5rem` · `--radius-box: 0.5rem` · `--depth: 0` `[assumption]` | Within daisyUI's allowed values. Note: a medium field is `--size-field` × 10 (35–40px here); the 32px target is the small size (`btn-sm`, `input-sm`) at 0.25rem — see `daisyui.md` |
| Tailwind `@theme` | Keep `--spacing: 0.25rem`; body uses `--text-sm` (14px / 20px) | Tailwind defaults |

## B2C — consumer service (phone first, reading, onboarding)

Primary references: Apple HIG · Material 3 · Carbon (expressive set) · Astryx Neutral's touch rule
(body 14 → 16px on coarse pointers below the large breakpoint).

| Axis | Starting value | Basis |
|---|---|---|
| Body size / line height | 16px / 24px (iOS feel: 17 / 22) | M3 body large · Carbon `body-02` · Astryx touch screens · HIG Body. Measured 16 / 22–24 |
| Secondary · label | 14 / 20 · 12 / 16 · minimum 11 | M3 · HIG iOS minimum |
| Headings | 24 / 32 · 28 / 36 · 32 / 40 · hero 36 / 44 | M3 headline small / medium / large · display small. Measured screen title 24 (24–28) |
| Letter-spacing | Set from the typeface | Carbon expressive 0 at 16px · M3 +0.5sp (Roboto) · SF Pro −0.43pt at 17pt. Measured body `normal` 3/3 |
| Control height | 44px (44–48) | HIG iOS default 44×44pt · Android minimum touch target 48dp · shadcn `maia` 40px+. Measured primary button 48 (36–48) |
| Radius | Buttons and chips: pill · cards 12px+ | Measured pill buttons 3/3 · shadcn `luma` · `maia`. Measured card images 8 |
| Spacing | 4px grid · between bordered controls 8–12 · around borderless elements 24 · phone side margin 16 · card padding 16–24 `[assumption]` · section gap 24–48 `[assumption]` | HIG ~12pt around bordered, ~24pt around borderless elements; measured chip gap 8 (8–12) · measured side margin 16 (16–24) · section gap derived from the Carbon spacing scale |
| Separation | Soft elevation | shadcn `luma` |
| Layout | Single column `[assumption]` · bottom tabs at phone width, five or fewer · reading width 640–720px `[assumption]` · design for widths under 600 first | Measured bottom tabs 2/3 (3–4 tabs) · HIG tab bars · Android compact window class. Measured desktop structures diverged (full width · app shell · 984px centered), so reading width has no median |
| shadcn style | `maia` (pill + soft shadows: `luma`; more density: `rhea`) | Final choice by the shadcn skill's "Picking a style" table |
| daisyUI theme | `--size-field: 0.28125rem` `[assumption]` · `--radius-field: 2rem` · `--radius-box: 1rem` `[assumption]` | Medium field = 45px. Pill fields: measured 3/3 |
| Tailwind `@theme` | Keep `--spacing: 0.25rem`; body uses `--text-base` (16px / 24px) | Tailwind defaults |

## Commerce — buyer screens (listing, product detail, cart, checkout)

Primary references: the B2C column as the base · Polaris (Checkout, Customer accounts) · measured
listing and detail screens. No public design system publishes tokens for storefront buyer screens —
Polaris today covers admin and checkout — so most values here are measured. Where Korean and global
stores split, both are given; pick by market or brand.

| Axis | Starting value | Basis |
|---|---|---|
| Body size / line height | 16px / 24px · product card text 13–14 | Measured body 16 in 3/4 (Musinsa 14) · measured card price 13 · M3 body medium 14 |
| Secondary · label | 12 / 16 | B2C column |
| Product name · price | Name 18 / 24 · price 16–18, weight 500–600 | Measured name 18 (14–24) · measured price 3 services. Tabular numerals were off 0/3 — use them only where amounts stack in columns (cart, comparison table) `[assumption]` |
| Letter-spacing | As B2C | Measured body `normal` 4/4 (one store tracks prices +0.05em) |
| Control height | General controls 44px `[assumption]` · buy button 50 · phone: fixed bottom buy bar | Measured buy button 50 (44–62) · bottom bar 4/4, 62–69px tall (119 where it also shows name and price) |
| Radius | Product images and cards 0 · buy button 4px (Korean) or pill (global) | Measured image radius 0 in 4/4 · buy button 4px 2/2 Korean, pill 2/2 global — a brand decision |
| Spacing | Product grid gap: phone 4 · desktop 13 · product card = image + text, no inner padding | Measured grid gap 0–10 (phone), 0–20 (desktop; one store uses 60 vertically) · inner padding 0 in 4/4. Polaris card padding 16 is an admin value — not used here |
| Separation | No border or shadow on product cards | Measured 4/4 |
| Layout | Product grid: phone 2–3 columns (Korean 3, global 2) · desktop 4 (3–6) · image 1:1 (fashion also 5:6 or 4:5) · Korean stores: five bottom tabs on phones | Measured listing columns · image ratio 1:1 in 3/4 listings, 5:6 and 4:5 on fashion detail · bottom tabs Korean 2/2, global 0/2 |
| shadcn style | `vega` or `maia` `[assumption]` | |
| daisyUI theme | `--size-field: 0.25rem`–`0.28125rem` `[assumption]` · `--radius-field: 0.25rem` (Korean) or `2rem` (global pill) · product images radius 0 instead of `--radius-box` | Measured image radius 0 in 4/4 |
| Tailwind `@theme` | As B2C | |

---

## Measuring similar services

Use this to replace `[assumption]` cells and to fit the starting values to the services the user
named. It needs a browser tool that can set the viewport and run a script on the page. Without one,
skip it and say so.

1. **Pick 2–3 services.** The user names them; otherwise propose some and confirm. Measure only
   public screens that open without logging in. Record the screen type (product screen / marketing
   page / docs). **Correct product-screen values only from product screens.** A SaaS's public pages
   are usually marketing pages, which follow the expressive (consumer-like) scale; mixing them in
   drags SaaS values toward B2C. If only marketing pages open, keep the starting value for that axis.
   For SaaS product values, a design system's public component docs (real components rendered) are a
   valid source.
2. **Measure at 375px (phone, touch) and 1440px (desktop).** At each width read these anchors: body
   paragraph · screen title · primary button · input · card · list or table row · navigation · page
   container (width and side margins) · grid gap · product image (commerce).

   ```js
   const pick = (sel) => {
     const el = document.querySelector(sel);
     if (!el) return null;
     const s = getComputedStyle(el), r = el.getBoundingClientRect();
     return { fontFamily: s.fontFamily.split(",")[0], fontSize: s.fontSize, lineHeight: s.lineHeight,
       letterSpacing: s.letterSpacing, fontWeight: s.fontWeight, fontVariantNumeric: s.fontVariantNumeric,
       height: r.height, width: r.width, padding: s.padding, margin: s.margin, gap: s.gap,
       border: s.border, boxShadow: s.boxShadow, borderRadius: s.borderRadius, position: s.position,
       gridTemplateColumns: s.gridTemplateColumns, maxWidth: s.maxWidth };
   };
   ```

   Count what the snippet cannot read (grid columns, number of bottom tabs) from a screenshot. Don't
   log in, submit forms, or click consent buttons; a banner covering the page doesn't change the DOM
   values underneath.
3. **Write one row per service, then take the median.** With two services, write a range and keep
   the starting value if it falls inside. Convert letter-spacing to `em` (px ÷ font size) so the
   ratio survives a size change.
4. **Keep the evidence** in `docs/design-system/benchmark.md` — service · URL · screen type · width ·
   anchor · value — and point to it from the `DESIGN.md` comment of each value it changed.
5. **Borrow scale and structure only.** Never colors, logos, or paid typefaces. SF Pro may not be
   used off Apple platforms; name a substitute in `DESIGN.md`.
