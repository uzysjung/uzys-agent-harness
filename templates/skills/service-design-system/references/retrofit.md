# Retrofit — bringing a half-built UI into one system

Use when screens already exist and there is no `DESIGN.md`. The goal is the same `DESIGN.md` a new
project would get, but chosen with the values users already see, and applied screen by screen with
the user's approval — never as one sweeping rewrite.

## 1. Before touching anything

- The git working tree is clean. If not, recommend a commit and stop.
- Record the baseline: the project's lint result if a linter exists (count per file), and, with a
  browser tool, a screenshot of each main screen at 375px and 1440px.
- If `DESIGN.md` already exists, it is the target: skip collection and convergence, list where the
  screens deviate from it, and go to section 4.

## 2. Collect the values in use

Run from the project root against the screen and style sources (adjust the directories). Count
every distinct value; the output feeds a table of property · value · uses · files.

```bash
SRC="src app templates components"   # screen and style sources that exist
# Tailwind classes
grep -rhoE '\btext-(xs|sm|base|lg|[2-9]?xl)\b' $SRC | sort | uniq -c | sort -rn          # type sizes
grep -rhoE '\b(leading|tracking)-[a-z0-9.]+\b' $SRC | sort | uniq -c | sort -rn             # line height, tracking
grep -rhoE '\b(h|min-h|size)-[0-9.]+\b' $SRC | sort | uniq -c | sort -rn                    # control heights
grep -rhoE '\brounded(-[a-z0-9]+)?\b' $SRC | sort | uniq -c | sort -rn                      # radius
grep -rhoE '\b(gap|space-[xy]|p[xytblr]?|m[xytblr]?)-[0-9.]+\b' $SRC | sort | uniq -c | sort -rn  # spacing
grep -rhoE '[a-z:-]+-\[[^]]+\]' $SRC | sort | uniq -c | sort -rn                            # arbitrary values
grep -rhoE '\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}\b' $SRC | sort | uniq -c | sort -rn  # raw palette
grep -rnE 'style=' $SRC | wc -l                                                             # inline styles
# Plain CSS
grep -rhoE '#[0-9a-fA-F]{3,8}\b|(rgb|hsl|oklch)a?\([^)]*\)' --include='*.css' --include='*.scss' $SRC | sort | uniq -c | sort -rn
grep -rhoE '(font-size|line-height|letter-spacing|border-radius|box-shadow|height|gap|padding):[^;}]+' --include='*.css' --include='*.scss' $SRC | sort | uniq -c | sort -rn
```

With a browser tool, also read the computed values of the anchors on each main screen with the
snippet in `concept-presets.md` § Measuring similar services — classes miss values that come from
component libraries and inherited CSS.

## 3. Converge to one scale

1. **Fix the concept first** (SKILL.md step 1) and take its preset column as the frame.
2. **Map every collected value to the nearest step** of the preset scale for that property.
3. **Per anchor, keep the most-used existing value if it falls inside the preset range** — it is
   what users already see. Mark it `measured: this app, <n> uses`.
4. **Outside the range, take the preset value** and list the screens that will change because of it.
5. **Colors:** group near-identical values into one role (primary, surfaces, text, border, status).
   A raw palette color maps to the semantic role it plays. A color used once is not a role — map it
   to the nearest role or ask.
6. **A value used once is never kept just because it exists.**

Write `DESIGN.md` from the result (SKILL.md step 4) and show the user the table of collected value →
chosen value before applying anything.

## 4. Apply in this order

1. **`DESIGN.md`** — reviewed by the user.
2. **Theme** (the CSS file; for React through the shadcn skill, skipping its scaffold and
   "install everything" steps). The theme changes every screen at once: before applying it, list the
   screens whose look will change and get approval for the theme itself.
3. **The shared shell** (navigation, header, page container) — after approval.
4. **Screens, one at a time**, in the order the user picks (default: most used first). For each:
   replace raw colors, arbitrary values, and inline styles with tokens and components; run the lint
   on that screen; record the violation count before → after. Ask before the next screen.
5. **Screens not approved** keep their source untouched. List them as "look changed by the theme,
   source not converted".
6. **Lock** (SKILL.md step 7): rules at `error` for converted screens only, by file globs; report
   the remaining count for the rest. Widen the globs as screens are converted.

The files that change are `DESIGN.md`, the theme CSS, the lint config, and the approved screens'
sources. If anything else had to change, say what and why.

## 5. Report

- The collected-values table and the chosen value for each property.
- Per approved screen: violations before → after; screenshots before / after when a browser tool was
  available (otherwise say "not captured").
- Unapproved screens whose look changed through the theme.
- Values kept from the app vs. replaced by the preset, each with its reason.
