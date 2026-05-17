/**
 * design.ts — CLI visual design tokens (color, symbols, layout helpers).
 *
 * Aesthetic direction: **refined ops-report**. Mission control feel without
 * decoration noise. Phase markers + aligned 2-column rows + structured summary.
 *
 * Goals:
 *   1. Make input-wait points visually obvious (handled by @clack/prompts).
 *   2. Make the install pipeline output legible:
 *      - phase-segmented progress (━━━ Phase N · Title ━━━)
 *      - aligned per-asset rows (✓/⊘/✗ + id + meta)
 *      - explicit skipped/failed reporting (no silent skips)
 *      - terminal-width responsive (default 78)
 *   3. Zero runtime dependencies — emit raw ANSI escapes.
 *
 * `NO_COLOR` is honored per https://no-color.org.
 */

const isColorEnabled = (() => {
  if (process.env.NO_COLOR && process.env.NO_COLOR !== "") {
    return false;
  }
  // stdout may be missing in some test contexts
  return Boolean(process.stdout?.isTTY);
})();

function wrap(open: number, close: number) {
  return (s: string): string => {
    if (!isColorEnabled) {
      return s;
    }
    return `\x1b[${open}m${s}\x1b[${close}m`;
  };
}

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

export const symbol = {
  success: "✓",
  failure: "✗",
  skip: "⊘",
  arrow: "›",
  pointer: "▸",
  bullet: "•",
  warn: "⚠",
  /** Heavy horizontal box-drawing — phase dividers. */
  rule: "━",
  /** Middle dot — section separator. */
  mid: "·",
};

/** Default width for phase headers / dividers. Terminal default ≥ 78. */
export const DEFAULT_WIDTH = 78;

/** Render a legacy section header. Bold cyan with a leading arrow. (kept for backward compat) */
export function header(title: string): string {
  return c.bold(c.cyan(`${symbol.arrow} ${title}`));
}

/**
 * Render a phase header — `━━━ Phase N · Title ━━━━━━━...` (full-width).
 * v26.63.0 (deprecated): kept for non-interactive mode + backward compat.
 *   wizard 모드는 unifiedSection() 사용 (5-step 통합 — phase 카운터 무관).
 */
export function phaseHeader(n: number | string, title: string, width = DEFAULT_WIDTH): string {
  const label = `${symbol.rule}${symbol.rule}${symbol.rule} Phase ${n} ${symbol.mid} ${title} `;
  const fill = symbol.rule.repeat(Math.max(0, width - visibleLength(label)));
  return c.bold(c.cyan(`${label}${fill}`));
}

/**
 * v26.63.0 — Step 5 (Installing) 안의 sub-section 헤더.
 * `━━ Templates ━━` / `━━ External assets (n) ━━` / `━━ Codex artifacts ━━`.
 * phaseHeader (3 rule + Phase N + ·) 대비 단순 — 2 rule + title.
 */
export function unifiedSection(title: string, width = DEFAULT_WIDTH): string {
  const label = `${symbol.rule}${symbol.rule} ${title} `;
  const fill = symbol.rule.repeat(Math.max(0, width - visibleLength(label)));
  return c.bold(c.cyan(`${label}${fill}`));
}

/**
 * Render a section header (non-phase) — `━━━ Title ━━━━━━━...`.
 * Used for TARGET / SUMMARY / NEXT etc.
 */
export function sectionHeader(title: string, width = DEFAULT_WIDTH): string {
  const label = `${symbol.rule}${symbol.rule}${symbol.rule} ${title} `;
  const fill = symbol.rule.repeat(Math.max(0, width - visibleLength(label)));
  return c.bold(c.cyan(`${label}${fill}`));
}

/** Plain horizontal divider — `━━━...━━━` (no label). */
export function divider(width = DEFAULT_WIDTH): string {
  return c.dim(symbol.rule.repeat(width));
}

/**
 * Render a `key: value` row with a fixed-width left column for alignment.
 * Used in pre-flight / summary blocks (▸ TRACKS  executive, tooling).
 */
export function infoRow(key: string, value: string, width = 12): string {
  const label = `${symbol.pointer} ${key}`.padEnd(width + 2, " ");
  return `  ${c.dim(label)} ${value}`;
}

/** Backward-compat — `keyValue` (used by older install report). */
export function keyValue(key: string, value: string, width = 16): string {
  const padded = `${key}:`.padEnd(width, " ");
  return `  ${c.dim(padded)} ${value}`;
}

/**
 * Render an asset row — `  ✓ asset-id                       meta`.
 * symbol = success/skip/failure. label = stable id (left-pad). meta = dim right column.
 */
export function assetRow(
  kind: "success" | "skip" | "failure",
  label: string,
  meta = "",
  labelWidth = 40,
): string {
  const sym = renderSymbol(kind);
  const labelPadded = label.padEnd(labelWidth, " ");
  const metaText = meta ? c.dim(meta) : "";
  return `  ${sym} ${labelPadded} ${metaText}`.trimEnd();
}

function renderSymbol(kind: "success" | "skip" | "failure"): string {
  switch (kind) {
    case "success":
      return c.green(symbol.success);
    case "skip":
      return c.yellow(symbol.skip);
    case "failure":
      return c.red(symbol.failure);
  }
}

export const status = {
  success: (msg: string): string => `${c.green(symbol.success)} ${msg}`,
  failure: (msg: string): string => `${c.red(symbol.failure)} ${msg}`,
  warn: (msg: string): string => `${c.yellow(symbol.warn)} ${msg}`,
  info: (msg: string): string => `${c.cyan(symbol.bullet)} ${msg}`,
};

/**
 * Strip ANSI escape sequences so visible width can be measured (for header padding).
 */
function visibleLength(s: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape stripping requires \x1b
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

/**
 * v26.63.2 — Pad to fixed display width (ANSI-aware). spacing scale 정렬 용.
 */
export function padDisplay(s: string, width: number): string {
  const visible = visibleLength(s);
  return visible >= width ? s : s + " ".repeat(width - visible);
}
