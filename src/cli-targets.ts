/**
 * CLI targets parser — v0.7.0 multi-select.
 *
 * SPEC: docs/specs/cli-multi-select.md F2 (parseCliTargets).
 *
 * Input shapes:
 *   - undefined / null / "" / [] → ["claude"] (default)
 *   - "claude" / "codex" / "opencode" / "antigravity" → single-element array
 *   - ["claude", "codex"] (cac repeatable) → sorted array
 *   - "both" / "all" (v0.8.0 제거된 legacy alias) → ok=false + 마이그레이션 안내 (throw 아님)
 *   - "invalid" → ok=false + error (throw 아님)
 *
 * Output:
 *   - ok: 유효하면 true, reject 시 false (+ error 메시지, targets=["claude"] default)
 *   - targets: sorted ReadonlyArray<CliBase> (claude → codex → opencode → antigravity 순)
 *   - warnings: 메시지 배열 (현재 reject-only 정책이라 비어 있음)
 */

import { CLI_BASES, type CliBase, type CliTargets, isCliBase } from "./types.js";

/** SSOT — claude → codex → opencode → antigravity 정렬 순서. prompts.ts에서 import. */
export const CLI_BASE_SORT_ORDER: Record<CliBase, number> = {
  claude: 0,
  codex: 1,
  opencode: 2,
  antigravity: 3,
};

export interface ParseCliTargetsResult {
  ok: boolean;
  targets: CliTargets;
  warnings: ReadonlyArray<string>;
  /** ok=false 시 reject 사유. */
  error?: string;
}

/**
 * `--cli` 입력을 sorted CliTargets로 정규화.
 *
 * Default `["claude"]` (비어있거나 undefined일 때).
 * Invalid 모드는 reject (ok=false).
 *
 * v0.8.0 — `both`/`all` legacy alias 제거 (v0.7.0에서 1 release deprecation 거침).
 * `both`/`all` 입력 시 invalid reject + 마이그레이션 안내.
 */
export function parseCliTargets(input: string | string[] | undefined): ParseCliTargetsResult {
  const items = normalizeInput(input);
  if (items.length === 0) {
    return { ok: true, targets: ["claude"], warnings: [] };
  }

  const collected = new Set<CliBase>();
  const warnings: string[] = [];

  for (const item of items) {
    if (!isCliBase(item)) {
      // v0.8.0 — alias 제거 마이그레이션 힌트
      let hint = "";
      if (item === "both") {
        hint = "\n         v0.8.0 removed 'both' alias. Use --cli claude --cli codex.";
      } else if (item === "all") {
        hint =
          "\n         v0.8.0 removed 'all' alias. Use --cli claude --cli codex --cli opencode.";
      } else if (item.includes(",")) {
        // v0.7.1 — comma-separated input hint
        hint = "\n         Tip: comma-separated not supported. Use --cli A --cli B for multiple.";
      }
      return {
        ok: false,
        targets: ["claude"],
        warnings,
        error: `Invalid --cli value: ${item}. Must be one of: ${CLI_BASES.join(" | ")}${hint}`,
      };
    }
    collected.add(item);
  }

  const targets = [...collected].sort((a, b) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b]);
  return { ok: true, targets, warnings };
}

function normalizeInput(input: string | string[] | undefined): string[] {
  if (input === undefined || input === null) return [];
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed === "" ? [] : [trimmed];
  }
  return input.filter((s) => typeof s === "string" && s.trim() !== "").map((s) => s.trim());
}

/** Targets에 특정 base 포함 여부. has() 패턴. */
export function targetsInclude(targets: CliTargets, base: CliBase): boolean {
  return targets.includes(base);
}
