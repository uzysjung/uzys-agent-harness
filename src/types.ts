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
 * Base CLI: claude / codex / opencode (3 base). 7 combinations possible (2^3 - 1, empty 제외).
 * Legacy `both` / `all` alias는 v0.7.0 deprecation 거쳐 v0.8.0에서 invalid input.
 * Migration: `--cli claude --cli codex` (repeatable) 또는 multiselect 인터랙티브.
 */
export const CLI_BASES = ["claude", "codex", "opencode"] as const;
export type CliBase = (typeof CLI_BASES)[number];

export function isCliBase(value: unknown): value is CliBase {
  return typeof value === "string" && (CLI_BASES as readonly string[]).includes(value);
}

/** Sorted readonly array of CliBase. install pipeline의 분기 input. */
export type CliTargets = ReadonlyArray<CliBase>;

/** Optional opt-in feature flags collected interactively. */
export interface OptionFlags {
  withTauri: boolean;
  withGsd: boolean;
  withEcc: boolean;
  withPrune: boolean;
  withTob: boolean;
  /** Codex global opt-in: ~/.codex/skills/uzys-* 복사. D16 — 사용자 명시 동의 필수. */
  withCodexSkills: boolean;
  /** Codex global opt-in: ~/.codex/config.toml [projects."..."] trust entry. D16 동일. */
  withCodexTrust: boolean;
  /**
   * v0.6.0 — karpathy-coder pre-commit hook auto-wire (A 경로).
   * `.claude/settings.json` PreToolUse `Write|Edit` matcher에 hook entry 등록.
   * 활성화는 karpathy-coder plugin install 성공 후 + 사용자 명시 opt-in 시에만.
   * upstream `enforcement-patterns.md` "manual configuration" 권장과 정합 — opt-in 강제.
   */
  withKarpathyHook: boolean;
  /**
   * v0.7.0 — Codex slash 통일 opt-in.
   * `~/.codex/prompts/uzys-{spec,plan,build,test,review,ship}.md` 6 markdown prompt 글로벌 복사.
   * 활성화 시 Codex에서 `/uzys-spec` 등 Claude Code 컨벤션 slash 작동.
   * D16 보호 — 글로벌 영역 침범이라 opt-in 강제.
   * 기존 .agents/skills/uzys-(phase) 디렉토리의 SKILL.md ($name mention 형식)도 병존.
   */
  withCodexPrompts: boolean;
  /**
   * v26.42.0 — addyosmani/agent-skills opt-in (BREAKING vs prior auto-install on dev tracks).
   * Sibling option to withGsd. Same plugin install method (`addyosmani/agent-skills`
   * marketplace + `agent-skills@addy-agent-skills`).
   */
  withAddyAgentSkills: boolean;
  /**
   * v26.44.0 — uzys-harness 6-Gate slash commands (/uzys:spec ... /uzys:ship) opt-in.
   * BREAKING vs prior dev-track auto-install. Workflow 카테고리의 1 옵션.
   * `templates/commands/uzys/*.md` 매핑을 gating. 다른 baseline(rules/agents/hooks)은 유지.
   */
  withUzysHarness: boolean;
  /**
   * v26.44.0 — obra/superpowers (anthropics/claude-plugins-official marketplace 등록) opt-in.
   * Workflow 카테고리. /spec /plan /build /test /review /ship slash (no namespace) 가 깔림.
   */
  withSuperpowers: boolean;
}

export const DEFAULT_OPTIONS: OptionFlags = {
  withTauri: false,
  withGsd: false,
  withEcc: false,
  withPrune: false,
  withTob: false,
  withCodexSkills: false,
  withCodexTrust: false,
  withKarpathyHook: false,
  withCodexPrompts: false,
  withAddyAgentSkills: false,
  withUzysHarness: false,
  withSuperpowers: false,
};

/** Aggregate result of interactive flow — the spec the install pipeline consumes. */
export interface InstallSpec {
  tracks: Track[];
  options: OptionFlags;
  /** v0.7.0 — sorted readonly array of CliBase (이전: single CliMode). */
  cli: CliTargets;
  projectDir: string;
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
