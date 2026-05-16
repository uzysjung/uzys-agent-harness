import { anyTrack, hasDevTrack, hasUiTrack } from "./track-match.js";
import type { Track } from "./types.js";

/**
 * Source-relative paths under `templates/` map to project-relative targets under
 * the project root (typically `.claude/...` or `CLAUDE.md`).
 *
 * Each entry declares an `applies(spec)` predicate based on the selected tracks.
 * Phase C scope: rules + commands + agents + base skills + hooks + project CLAUDE.md.
 * Phase E will extend with the remaining track-specific skills.
 */

export interface AssetSpec {
  /** Selected tracks (union). */
  tracks: ReadonlyArray<Track>;
  /**
   * Optional opt-in: --with-tauri.
   * Note: copied from `OptionFlags.withTauri` by installer; keep both fields in sync
   * when adding new opt-in flags that affect manifest gating.
   */
  withTauri?: boolean;
  /**
   * v26.44.0 — uzys-harness 6-Gate slash commands opt-in (BREAKING).
   * Note: copied from `OptionFlags.withUzysHarness` by installer; keep both fields in sync.
   * Track-independent: opt-in on ANY track installs `/uzys:*` commands. SPEC R7.
   */
  withUzysHarness?: boolean;
  /**
   * v26.55.0 — withEcc gating (BREAKING).
   * Note: copied from `OptionFlags.withEcc` by installer; keep both fields in sync.
   * ECC cherry-pick (agents/skills/commands) 항목은 withEcc=true 일 때만 manifest 포함.
   * ADR-016 참조.
   */
  withEcc?: boolean;
}

export interface AssetEntry {
  source: string; // relative to repo `templates/`
  target: string; // relative to project root
  type: "file" | "dir";
  applies: (spec: AssetSpec) => boolean;
}

const all = (): boolean => true;
const dev = (s: AssetSpec): boolean => hasDevTrack(s.tracks);
const ui = (s: AssetSpec): boolean => hasUiTrack(s.tracks);
const onTracks =
  (pattern: string) =>
  (s: AssetSpec): boolean =>
    anyTrack(s.tracks, pattern);

const COMMON_RULES = ["git-policy", "change-management", "gates-taxonomy"];
const DEV_RULES = ["test-policy", "ship-checklist", "code-style", "error-handling"];
const UI_RULES = ["design-workflow", "playwright-launch"];

const TRACK_RULES: Record<Track, string[]> = {
  "csr-supabase": ["shadcn", "api-contract"],
  "csr-fastify": ["shadcn", "api-contract", "database"],
  "csr-fastapi": ["shadcn", "api-contract", "database"],
  "ssr-htmx": ["htmx"],
  "ssr-nextjs": ["nextjs", "shadcn"],
  data: ["pyside6", "data-analysis"],
  executive: [],
  tooling: ["cli-development"],
  full: [
    "shadcn",
    "api-contract",
    "database",
    "htmx",
    "nextjs",
    "pyside6",
    "data-analysis",
    "cli-development",
  ],
  // v0.5.0 — executive-style baselines (no dev rules; common rules only).
  "project-management": [],
  "growth-marketing": [],
};

/** Resolve the unique set of rule names to install for the given spec. */
export function resolveRules(spec: AssetSpec): string[] {
  const set = new Set<string>(COMMON_RULES);
  if (hasDevTrack(spec.tracks)) {
    for (const r of DEV_RULES) {
      set.add(r);
    }
  }
  if (spec.withTauri && anyTrack(spec.tracks, "csr-*|full")) {
    set.add("tauri");
  }
  if (hasUiTrack(spec.tracks)) {
    for (const r of UI_RULES) {
      set.add(r);
    }
  }
  for (const t of spec.tracks) {
    for (const r of TRACK_RULES[t]) {
      set.add(r);
    }
  }
  return [...set].sort();
}

const UZYS_COMMANDS = ["spec", "plan", "build", "test", "review", "ship", "auto"];

// v26.55.0 — ECC cherry-pick 분리. ADR-016.
// 본 프로젝트 (always): reviewer, data-analyst, strategist
// ECC (withEcc 필요): code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver
const CORE_AGENTS = ["reviewer", "data-analyst", "strategist"];
const CORE_AGENTS_ECC = ["code-reviewer", "security-reviewer"];

const DEV_AGENTS = ["plan-checker"];
const DEV_AGENTS_ECC = ["silent-failure-hunter", "build-error-resolver"];

/** Hooks installed for every project (parity with setup-harness.sh L815-826). */
const ALWAYS_HOOKS = [
  "session-start.sh",
  "protect-files.sh",
  "gate-check.sh",
  "agentshield-gate.sh",
  "mcp-pre-exec.sh",
  "spec-drift-check.sh",
  "checkpoint-snapshot.sh",
  "hito-counter.sh",
];

// v26.55.0 — ECC cherry-pick 분리. ADR-016.
const COMMON_SKILL_DIRS = ["north-star", "gh-issue-workflow"];
const COMMON_SKILL_DIRS_ECC = ["continuous-learning-v2", "strategic-compact", "deep-research"];

const DEV_SKILL_DIRS: string[] = [];
const DEV_SKILL_DIRS_ECC = ["eval-harness", "verification-loop", "agent-introspection-debugging"];

const UI_SKILL_DIRS = ["ui-visual-review"];
const UI_SKILL_DIRS_ECC = ["e2e-testing"];

// python-* skills (data|csr-fastapi|full) — 둘 다 ECC cherry-pick. withEcc + track 둘 다 필요.
const PYTHON_SKILL_DIRS_ECC = ["python-patterns", "python-testing"];

/** Build the full asset manifest for the given spec. */
export function buildManifest(spec: AssetSpec): AssetEntry[] {
  const m: AssetEntry[] = [];

  // Rules
  for (const r of resolveRules(spec)) {
    m.push({
      source: `rules/${r}.md`,
      target: `.claude/rules/${r}.md`,
      type: "file",
      applies: all,
    });
  }

  // uzys: commands (v26.44.0 — opt-in; BREAKING vs prior dev-track auto-install).
  // 본 harness 자체 6-Gate slash commands. Workflow 카테고리의 1 옵션.
  for (const cmd of UZYS_COMMANDS) {
    m.push({
      source: `commands/uzys/${cmd}.md`,
      target: `.claude/commands/uzys/${cmd}.md`,
      type: "file",
      applies: (s) => Boolean(s.withUzysHarness),
    });
  }

  // ecc: commands — v26.55.0 withEcc gating (BREAKING vs prior unconditional install). ADR-016.
  m.push({
    source: "commands/ecc",
    target: ".claude/commands/ecc",
    type: "dir",
    applies: (s) => Boolean(s.withEcc),
  });

  // Project meta CLAUDE.md
  m.push({
    source: "CLAUDE.md",
    target: ".claude/CLAUDE.md",
    type: "file",
    applies: all,
  });

  // Agents (본 프로젝트)
  for (const a of CORE_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: all,
    });
  }
  for (const a of DEV_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: dev,
    });
  }
  // v26.55.0 — Agents (ECC). ADR-016. withEcc gating.
  for (const a of CORE_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => Boolean(s.withEcc),
    });
  }
  for (const a of DEV_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => Boolean(s.withEcc) && hasDevTrack(s.tracks),
    });
  }

  // Common skill directories
  for (const sd of COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all,
    });
  }
  // v26.55.0 — Common skill dirs (ECC). ADR-016. withEcc gating.
  for (const sd of COMMON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => Boolean(s.withEcc),
    });
  }
  m.push({
    source: "skills/spec-scaling/SKILL.md",
    target: ".claude/skills/spec-scaling/SKILL.md",
    type: "file",
    applies: all,
  });
  m.push({
    source: "skills/market-research",
    target: ".claude/skills/market-research",
    type: "dir",
    applies: onTracks("executive|full"),
  });
  for (const sd of ["investor-materials", "investor-outreach"]) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: onTracks("executive|full"),
    });
  }
  m.push({
    source: "skills/nextjs-turbopack",
    target: ".claude/skills/nextjs-turbopack",
    type: "dir",
    applies: onTracks("ssr-nextjs|full"),
  });
  // v26.55.0 — python-* / DEV_SKILL_DIRS / UI_SKILL_DIRS 중 ECC 출처는 withEcc gating. ADR-016.
  for (const sd of PYTHON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => Boolean(s.withEcc) && anyTrack(s.tracks, "data|csr-fastapi|full"),
    });
  }
  for (const sd of DEV_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: dev,
    });
  }
  for (const sd of DEV_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => Boolean(s.withEcc) && hasDevTrack(s.tracks),
    });
  }
  for (const sd of UI_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: ui,
    });
  }
  for (const sd of UI_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => Boolean(s.withEcc) && hasUiTrack(s.tracks),
    });
  }

  // Hooks
  for (const h of ALWAYS_HOOKS) {
    m.push({
      source: `hooks/${h}`,
      target: `.claude/hooks/${h}`,
      type: "file",
      applies: all,
    });
  }

  // settings.json
  m.push({
    source: "settings.json",
    target: ".claude/settings.json",
    type: "file",
    applies: all,
  });

  // Project root CLAUDE.md — handled outside manifest by `mergeProjectClaude`
  // (single/multi/full tracks all merged from fragments in installer.ts).

  return m;
}
