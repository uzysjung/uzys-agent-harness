---
name: service-design-system
description: >-
  Builds a project design system from the service concept before screens are built,
  or consolidates a half-built UI into one. Writes DESIGN.md (tokens and rules) from a
  SaaS / B2C / commerce starting profile corrected by reference design systems and
  measurements of similar services, applies it to shadcn/ui (React) or daisyUI (other
  stacks), renders an in-app design-system page, and turns on lint so later screens are
  assembled from it. Use for "디자인 시스템 만들어줘", "디자인 통일해줘",
  "컨셉에 맞게 디자인 잡아줘", "DESIGN.md 만들어줘", "set up a design system",
  or when starting the first screens of a new service that has no DESIGN.md.
  Do NOT use for a single component or screen tweak, or when DESIGN.md already exists
  and the task is only to build with it — follow DESIGN.md directly.
---

# Service Design System

Without a system, every new screen picks its own sizes and colors, and a business dashboard ends up
with the same spacing and type as a consumer app. This skill fixes the values once, in `DESIGN.md`,
chosen for the kind of service being built, and then makes the code follow that file: a theme, an
in-app `/design-system` page that renders it, and lint that fails when a screen leaves it.

Values start from a **concept preset** (SaaS · B2C · commerce), are corrected by reference design
systems and by measuring 2–3 similar services, and every value records where it came from.

**The preset values are in `references/concept-presets.md`, next to this file.** This file does not
repeat them. If that file is not available to you, say so and ask for it — do not invent preset
values. The other references: `references/daisyui.md` (theme and page for non-React stacks) and
`references/retrofit.md` (consolidating a project that already has screens).

| Part of the job | Who does it |
|---|---|
| Concept → starting values → calibration → `DESIGN.md` | This skill |
| `DESIGN.md` → shadcn/ui theme, variants, design-system page (React) | The official shadcn skill (`design-system.md`, `design-system-page.md`) |
| `DESIGN.md` → daisyUI theme + Tailwind `@theme` + page (other stacks) | `references/daisyui.md` |
| Converging an existing UI | `references/retrofit.md` |
| Keeping later screens inside the system | Lint (`@shadcn/lint`, or ast-grep for templates) |

## 0. Read the state

Check `DESIGN.md`, the stack (`components.json` → shadcn/ui; `daisyui` in the CSS or package file →
daisyUI; the Tailwind major version; the framework), how many screens exist, and whether the git
working tree is clean.

| State | Mode |
|---|---|
| No screens, no `DESIGN.md` | **New** — steps 1–8 |
| Screens exist, no `DESIGN.md` | **Retrofit** — steps 1–4 with the collection in `references/retrofit.md`, then its apply order instead of a blanket step 5 |
| `DESIGN.md` exists | **Continue** — never overwrite it. Read it (another tool may have written it), run its lint, propose only the missing parts, then go to step 5 |

Before editing any existing source, the working tree must be clean. If it is not, recommend a
commit and stop.

## 1. Pin the concept

Needed: service type (SaaS · B2C · commerce · mixed), primary device, information density, 2–3
similar services, and whether brand color and typeface are already decided. Take them from the
conversation, README, or product docs first. Ask only for what is missing, in one bundled question.

- **No brand color or typeface:** choose them and mark both as `assumption` with the reason.
  `DESIGN.md` requires a `primary` color, and letter-spacing depends on the typeface.
- **Mixed services:** assign a concept per surface — buyer screens use commerce, a seller admin uses
  SaaS, a consumer app with a shop uses B2C plus commerce for the shop screens.
- **Outside the presets** (finance, health, education, …): for each surface take the column whose
  density and input mode fit best (desk and dense data → SaaS; phone and touch → B2C), mark every
  borrowed value `assumption`, and lean on step 3.

## 2. Take the starting values

Copy the matching column of `references/concept-presets.md` with each value's basis. Cells marked
`[assumption]` stay assumptions until step 3 replaces them. The presets give no letter-spacing
number on purpose: tracking belongs to the typeface. Set it after choosing the typeface, from that
typeface's or design system's published values or from measurement.

## 3. Calibrate

Change a starting value only with a reason, in this order:

1. **Reference design systems** named in the preset column — their documented values.
2. **Similar services, measured** — only when a browser tool can run a script on a page. The
   procedure and snippet are in `references/concept-presets.md` § Measuring similar services. Public
   screens only; product-screen values are corrected only from product screens; borrow scale and
   structure, never colors, logos, or paid fonts. Keep the evidence table in
   `docs/design-system/benchmark.md`.

No browser tool → skip measurement, do not create `benchmark.md`, and write "No measurement —
reference values only" in the report. `measured` names who measured what: the preset's sample
(`measured: preset sample, GitHub · GitLab · Hugging Face`) or your own step-3 table. Never write
`measured` for a value nobody measured.

## 4. Write `DESIGN.md`

Follow the format that `npx @google/design.md spec` prints (the format is alpha — trust the command
over memory). Sections in order: Overview · Colors · Typography · Layout · Elevation & Depth ·
Shapes · Components · Do's and Don'ts. Then run `npx @google/design.md lint DESIGN.md`, fix errors,
and report contrast warnings.

- **Every token carries its provenance** as a YAML comment: `# source: <system and token>`,
  `# measured: <whose sample, services, n/m>`, or `# assumption: <why>`.
- **Minimum tokens:** `colors.primary` (and the surface / text / border / status roles you use),
  `typography.body` and `typography.heading` (each with `fontFamily`, `fontSize`, `lineHeight`,
  `letterSpacing`), the label and caption styles, `rounded` steps, `components.button.height`,
  `components.input.height`, `spacing.control-gap`, `spacing.card-padding`, `spacing.section-gap`.
- **Layout** states the shell (side panel + content · single column · product grid), the phone
  navigation (bottom tabs, five or fewer · drawer), content width, and grid columns per width.
  Numeric layout values also go in `spacing` (`sidebar-width: 240px`, `grid-columns-phone: '2'`).
- **Do's and Don'ts** turns the system into rules a reviewer can check: no raw palette colors, no
  arbitrary values, control heights only from the scale, one primary action per group.

The shape of the token block (values here are from the SaaS column; take yours from step 2–3):

```yaml
---
version: alpha
name: <Product> Design System
colors:
  primary: "#2563EB"        # assumption: no brand color given; blue reads as "work tool"
typography:
  body:
    fontFamily: Inter       # assumption: no typeface given
    fontSize: 14px          # source: Carbon body-01
    lineHeight: 20px        # source: Carbon body-01
    letterSpacing: 0em      # measured: preset sample, body tracking normal 3/3
components:
  button:
    height: 32px            # measured: preset sample, median of 3 SaaS screens
spacing:
  control-gap: 8px          # source: Polaris button group
---
```

## 5. Apply

**React with the official shadcn skill:** follow its `design-system.md` from "Read the DESIGN.md"
onward; it maps colors, radius, shadows, fonts, a `type-*` scale with letter-spacing, control
heights, and variants. In an existing project skip its scaffold and "install everything" steps and
work only with installed components. If `components.json` exists, keep the style, and never run
`shadcn apply` without approval — it overwrites components, fonts, and CSS variables.

If that skill, or its `design-system.md`, is missing: stop after `DESIGN.md`, and tell the user the
one command to add or update it (for example `npx skills add shadcn/ui --skill shadcn --copy`).
Do not map the theme by hand.

**Any other stack** (server templates, htmx, server JSX, Vue, Svelte, a single HTML file):
`references/daisyui.md`. If the project uses another CSS system or Tailwind v3, ask before
switching — that rewrites the styling base.

## 6. Render the `/design-system` page

An in-app route built from the real theme and real components, so it cannot drift from the code.
For a single-file deliverable, it is a section of that file (`#design-system`). React: the shadcn
skill's `design-system-page.md`, its helpers, and its coverage script. Other stacks: the page
outline in `references/daisyui.md`. Draw one example screen in the shell from the Layout section.
Ask whether the page may ship to production; propose development-only.

## 7. Lock it with lint

Turn rules on after the user confirms which ones. Lint the **app screen sources**.

- React and server JSX: `@shadcn/lint` (set up per its SETUP.md) with `no-raw-colors`,
  `no-arbitrary-values`, `no-restyle`, `no-unknown-classes`, `no-inline-styles`.
- HTML and Jinja-style templates: ast-grep rules for raw palette colors, arbitrary values, and
  `style=` (the project's own, or the one in `references/daisyui.md`).
- The showcase folder is excluded from `no-inline-styles` only (the upstream showcase helpers set
  colors inline); it keeps the other rules. Report the excluded path.
- Violations in generated component source (`components/ui`): keep the rules on and report the
  count per file.
- Prove the lint bites: put `bg-pink-500` in one screen, see it fail, remove it.

Propose one line for the project's instruction file (`CLAUDE.md` or `AGENTS.md`): "Build UI from the
tokens in DESIGN.md and the components shown at /design-system." If a visual-review skill keeps a
list of pages to capture, add `/design-system` to it.

## 8. Report

- Concept, mode, and stack.
- Value table: token · value · provenance (`source` / `measured` / `assumption`) · note.
- What went to the shadcn skill or `references/daisyui.md`; the style or theme chosen and why.
- Lint: rules on, excluded paths, counts in generated files.
- Skipped steps and why (no browser, no shadcn skill, no shell), and every question still open.

## Where it stops and asks

- Concept inputs missing → one bundled question (brand color and typeface may be assumed instead).
- Dirty working tree before editing existing source → recommend a commit, stop.
- React without the shadcn skill or its `design-system.md` → stop after `DESIGN.md`.
- `shadcn apply`, switching CSS system, or overwriting an existing theme → approval first.
- Which lint rules to enable; whether `/design-system` ships to production.
- Retrofit: each shared shell and each screen is converted only after approval.

## Without tools

If you can only write files in your reply (no shell, no browser): run step 0 from what you are
given, step 1 by asking or assuming (marked), step 2 from the presets, and step 3 from reference
values only, stating "No measurement — reference values only". Then write the files in order:
`DESIGN.md` → theme CSS (or the theme block in the HTML head) → the screens and the design-system
page → the lint config. End with the commands the user should run (`npx @google/design.md lint
DESIGN.md`, the project lint, the build) and say that none of them were run.
