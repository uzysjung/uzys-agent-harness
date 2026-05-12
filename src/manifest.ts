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
  /** Optional opt-in: --with-tauri. */
  withTauri?: boolean;
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
const UI_RULES = ["design-workflow"];

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

const CORE_AGENTS = [
  "reviewer",
  "data-analyst",
  "strategist",
  "code-reviewer",
  "security-reviewer",
];

const DEV_AGENTS = ["silent-failure-hunter", "build-error-resolver", "plan-checker"];

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

const COMMON_SKILL_DIRS = [
  "continuous-learning-v2",
  "strategic-compact",
  "north-star",
  "gh-issue-workflow",
  "deep-research",
];

const DEV_SKILL_DIRS = ["eval-harness", "verification-loop", "agent-introspection-debugging"];

const UI_SKILL_DIRS = ["e2e-testing", "ui-visual-review"];

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

  // uzys: commands (dev tracks)
  for (const cmd of UZYS_COMMANDS) {
    m.push({
      source: `commands/uzys/${cmd}.md`,
      target: `.claude/commands/uzys/${cmd}.md`,
      type: "file",
      applies: dev,
    });
  }

  // ecc: commands — copy directory wholesale (every project)
  m.push({
    source: "commands/ecc",
    target: ".claude/commands/ecc",
    type: "dir",
    applies: all,
  });

  // Project meta CLAUDE.md
  m.push({
    source: "CLAUDE.md",
    target: ".claude/CLAUDE.md",
    type: "file",
    applies: all,
  });

  // Agents
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

  // Common skill directories
  for (const sd of COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all,
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
  for (const sd of ["python-patterns", "python-testing"]) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: onTracks("data|csr-fastapi|full"),
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
  for (const sd of UI_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: ui,
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
