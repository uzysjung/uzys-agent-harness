/** Available installation tracks. v0.5.0 — 11 Track (PM/Growth Marketing 추가). */
export const TRACKS = [
  "tooling",
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "executive",
  "full",
  "project-management",
  "growth-marketing",
] as const;
export type Track = (typeof TRACKS)[number];

export function isTrack(value: unknown): value is Track {
  return typeof value === "string" && (TRACKS as readonly string[]).includes(value);
}

/**
 * CLI target — multi-select base × combination (v0.8.0 — alias 제거).
 *
 * Base CLI: claude / codex / opencode / antigravity (4 base). 15 combinations possible (2^4 - 1, empty 제외).
 * Legacy `both` / `all` alias는 v0.7.0 deprecation 거쳐 v0.8.0에서 invalid input.
 * Migration: `--cli claude --cli codex` (repeatable) 또는 multiselect 인터랙티브.
 */
export const CLI_BASES = ["claude", "codex", "opencode", "antigravity"] as const;
export type CliBase = (typeof CLI_BASES)[number];

export function isCliBase(value: unknown): value is CliBase {
  return typeof value === "string" && (CLI_BASES as readonly string[]).includes(value);
}

/** Sorted readonly array of CliBase. install pipeline의 분기 input. */
export type CliTargets = ReadonlyArray<CliBase>;

/**
 * v26.64.0 (ADR-020) — Installation scope.
 *
 * - "project" (default): claude plugin `--scope project`, npx skills (default), npm `--save-dev`,
 *   codex/opencode → 프로젝트 dir (`.codex/`, `.opencode/`). 사용자 명시 동의 없이는 글로벌 미수정.
 * - "global" (opt-in): claude plugin `--scope user`, npx skills `-g`, npm `-g`,
 *   codex/opencode → `~/.codex/`, `~/.opencode/`. 사용자가 interactive 또는 `--scope global` 로 명시.
 *
 * NORTH_STAR.md D16 본질 — 사용자 무인지 글로벌 write 금지.
 */
export const INSTALL_SCOPES = ["project", "global"] as const;
export type InstallScope = (typeof INSTALL_SCOPES)[number];

export function isInstallScope(value: unknown): value is InstallScope {
  return typeof value === "string" && (INSTALL_SCOPES as readonly string[]).includes(value);
}

/**
 * v26.64.0 (ADR-020) — `InstallSpec.scope` 가 optional 이므로 사용 시 default "project" 로 normalize.
 * 모든 분기 코드 (external-installer, codex/*, opencode/*) 는 이 함수로 scope 결정.
 */
export function resolveScope(scope: InstallScope | undefined): InstallScope {
  return scope ?? "project";
}

/**
 * Optional opt-in feature flags collected interactively.
 *
 * v26.81.0 (ADR-022, BREAKING) — 자산 1:1 boolean 13종(withGsd/withEcc/withTob/
 * withSuperpowers/withAddyAgentSkills/withWshobsonAgents/withOpenspec/withBmad/
 * withClaudeVideo/withUnderstandAnything/withAgentmemory + withTauri/withUzysHarness)
 * 완전 삭제. 자산 선택은 `userOverride.forceInclude`(wizard 체크 / `--with <id>`)로
 * 일원화 — 자산 추가 시 플래그 코드 0곳. 잔존 6종 = 자산이 아닌 **설치 동작 옵션**만.
 */
export interface OptionFlags {
  /** ecc-prune 실행 결합 — prune 은 ecc-plugin 선택을 전제 (installer.ts eccSelected 가 처리). */
  withPrune: boolean;
  /** Codex global opt-in: ~/.codex/config.toml [projects."..."] trust entry. D16 — 사용자 명시 동의 필수. */
  withCodexTrust: boolean;
  /**
   * v0.6.0 — karpathy-coder pre-commit hook auto-wire (A 경로).
   * `.claude/settings.json` PreToolUse `Write|Edit` matcher에 hook entry 등록.
   * 활성화는 karpathy-coder plugin install 성공 후 + 사용자 명시 opt-in 시에만.
   */
  withKarpathyHook: boolean;
}

export const DEFAULT_OPTIONS: OptionFlags = {
  withPrune: false,
  withCodexTrust: false,
  withKarpathyHook: false,
};

/** Aggregate result of interactive flow — the spec the install pipeline consumes. */
export interface InstallSpec {
  tracks: Track[];
  options: OptionFlags;
  /** v0.7.0 — sorted readonly array of CliBase (이전: single CliMode). */
  cli: CliTargets;
  projectDir: string;
  /**
   * v26.64.0 (ADR-020) — Installation scope. Default "project" — 사용자 무인지 글로벌 write 방지.
   * Interactive prompt 또는 `--scope global` 명시 시에만 "global".
   * Optional + default "project" — 명시 안 한 사용처 (기존 tests / wizard non-scope-aware) 안전한 fallback.
   * 사용처는 `resolveScope(spec.scope)` 또는 `scope ?? "project"` 로 normalize.
   */
  scope?: InstallScope;
  /**
   * v26.47.0 — User-level override of preset/option condition (Phase C full).
   * `forceInclude`: condition 무관 강제 포함 / `forceExclude`: condition 무관 강제 제외.
   * 우선순위: forceExclude > forceInclude > condition.
   * Optional — 미제공 시 기존 condition 만 평가 (backward compat).
   */
  userOverride?: {
    forceInclude: ReadonlyArray<string>;
    forceExclude: ReadonlyArray<string>;
  };
}
