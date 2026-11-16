# DESIGN.md → daisyUI theme, Tailwind `@theme`, and the design-system page

For every stack that is not React with shadcn/ui: server templates (Jinja and similar), htmx, server
JSX, Vue, Svelte, a single HTML file. Requires Tailwind CSS v4 and daisyUI 5. If the project uses
Tailwind v3 or another CSS system, ask before switching.

Two layers carry the tokens. **daisyUI owns color, radius, control size, border, and depth.**
**Tailwind `@theme` owns type, letter-spacing, spacing, and widths** — daisyUI has no tokens for
those.

## 1. daisyUI theme

One `@plugin "daisyui/theme"` block in the main CSS file. Include every variable; daisyUI's own
guidance is to write the whole set rather than a partial one.

| DESIGN.md | daisyUI variable |
|---|---|
| page surface · raised surface · deeper surface | `--color-base-100` · `--color-base-200` · `--color-base-300` |
| body text on surfaces | `--color-base-content` |
| primary · on-primary | `--color-primary` · `--color-primary-content` |
| secondary · accent (and their on-colors) | `--color-secondary(-content)` · `--color-accent(-content)` |
| dark neutral areas | `--color-neutral(-content)` |
| info · success · warning · error | `--color-info` … `--color-error` and each `-content` |
| radius for buttons, inputs, selects, tabs | `--radius-field` |
| radius for cards, modals, alerts | `--radius-box` |
| radius for checkbox, toggle, badge | `--radius-selector` |
| control height | `--size-field` (and `--size-selector`) |
| border width | `--border` |
| shadows on / off · grain on / off | `--depth` (0 or 1) · `--noise` (0 or 1) |

Allowed values (daisyUI's own ranges): radius 0 · 0.25 · 0.5 · 1 · 2rem; `--size-field` and
`--size-selector` 0.25rem by default, larger 0.28125 · 0.3125, smaller 0.21875 · 0.1875; `--border`
1px (0.5 · 1.5 · 2); `--depth` and `--noise` 0 or 1.

**Control height is `--size-field` times a size multiplier:** xs ×6 · sm ×8 · md ×10 (default) ·
lg ×12 · xl ×14. At a 16px root and 0.25rem that is 24 · 32 · 40 · 48 · 56px. Pick the pair that
lands on the `DESIGN.md` height and state it in the Components section — a 32px SaaS control is
`btn-sm` / `input-sm` at 0.25rem; a 44–45px touch control is the default size at 0.28125rem. If the
default size is not the one you use, say so in Do's and Don'ts ("buttons are always `btn-sm`").

```css
@import "tailwindcss";
@plugin "daisyui" { themes: false; }
@plugin "daisyui/theme" {
  name: "app";
  default: true;
  color-scheme: light;
  --color-base-100: #ffffff;
  /* … all 20 colors, the three radii, both sizes, border, depth, noise … */
}
```

**Single HTML file (CDN build).** `@plugin` does not load through the browser build, so define the
theme as a selector and put the Tailwind tokens in a `text/tailwindcss` style block:

```html
<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css" />
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<style>
  [data-theme="app"] { color-scheme: light; --color-primary: #2563eb; /* … the full set … */ }
</style>
<style type="text/tailwindcss">
  @theme { /* section 2 */ }
</style>
<!-- <html data-theme="app"> -->
```

## 2. Tailwind `@theme`

Keep `--spacing: 0.25rem` (the 4px grid every preset uses); spacing utilities are multiples of it.
Name each `DESIGN.md` type style as a `--text-*` token and carry line height, letter-spacing, and
weight with it, so one class sets all four:

```css
@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --text-body: 0.875rem;
  --text-body--line-height: 1.25rem;
  --text-body--letter-spacing: 0em;
  --text-title: 1.25rem;
  --text-title--line-height: 1.75rem;
  --text-title--font-weight: 600;
  --container-reading: 45rem;
}
@layer base {
  body { font-size: var(--text-body); line-height: var(--text-body--line-height); }
}
```

Use `text-body`, `text-title` in markup. In JSX that merges classes with `cn()` / tailwind-merge,
custom `text-*` names can be mistaken for colors and dropped; there, define `@utility type-body { … }`
instead, as the shadcn skill does. Convert pixel tracking to `em` (px ÷ size).

## 3. The design-system page

A route only for development by default (register it only when the app runs in development mode;
ask before exposing it in production). For a single HTML file it is a section, `#design-system`.
Render everything with the real theme and real daisyUI classes — never screenshots or hard-coded
colors.

1. **Header** — system name, "Built from DESIGN.md", section links, theme toggle if there is a dark theme.
2. **Color roles as pairs** — each surface with "Aa" in its `-content` color, the token name, the
   value, and the contrast ratio. Mark pairs under 4.5:1 and list them in the report.
3. **Type specimen** — one row per type token: sample text in the product's own words, size / line
   height / letter-spacing / weight.
4. **Spacing, radius, size, depth** — the spacing steps in use, the three radii with the components
   that use each, the control size ladder (xs–xl with pixel heights), cards with `--depth` on.
5. **Components used by the app** — buttons (each variant × default · hover · focus · active ·
   disabled, pinned side by side with `btn-active`, `btn-disabled`, and a focus outline class),
   fields (default · focus · error · disabled), card, table, alert, badge, tabs, navigation, a
   modal with a real trigger. Include long text, empty, error, and loading cases.
6. **Do and Don't pairs** for the `DESIGN.md` rules.
7. **One example screen** in the shell from the Layout section (side panel + content, single column
   with bottom tabs, or product grid), built only from tokens and components.

Coverage: list the daisyUI component classes the screens use and check each appears on the page.

```bash
grep -rhoE '\b(btn|card|input|select|textarea|checkbox|radio|toggle|badge|alert|table|tabs|menu|navbar|modal|drawer|dropdown|tooltip|toast|steps|stat|avatar|join|pagination|breadcrumbs|progress|loading|skeleton|collapse)\b' <screen dirs> | sort -u
```

## 4. Lint for templates

`@shadcn/lint` reads JSX, Vue, and Svelte, not HTML templates. For templates use ast-grep
(`pip install ast-grep-cli` or `npm i -D @ast-grep/cli`) unless the project already has rules.
`sgconfig.yml`:

```yaml
ruleDirs: [rules]
languageGlobs: { html: ["*.jinja", "*.jinja2", "*.j2"] }
```

`rules/tailwind-tokens.yml`:

```yaml
id: tailwind-tokens
language: html
severity: error
message: Use daisyUI theme colors, scale values, and classes instead of raw palette colors, arbitrary values, or inline style
rule:
  any:
    - kind: attribute_value
      regex: (^|[^\w-])[a-z-]+-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)(/\d+)?([^\w-]|$)
      inside: &class { kind: attribute, has: { kind: attribute_name, regex: ^class$ }, stopBy: end }
    - { kind: attribute_value, regex: '-\[[^\]]+\]', inside: *class }
    - { kind: attribute, has: { kind: attribute_name, regex: ^style$ } }
```

Run `ast-grep scan`, add it to the project's lint command, and prove it bites by adding
`class="bg-pink-500"` to one template. It cannot catch misspelled or nonexistent classes. Exclude the
design-system page from the `style=` rule only if it needs inline style to show raw values.
