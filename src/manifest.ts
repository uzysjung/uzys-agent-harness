import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
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
   * v26.58.0 — withEcc opt-out gating (BREAKING vs v26.55.0). ADR-019 supersedes ADR-016 부분.
   * Note: copied from `OptionFlags.withEcc` by installer; keep both fields in sync.
   *
   * 정책 (cherry-pick × plugin gating):
   * - C1 (단순 중복): 매핑 자체 삭제. 현재 0개.
   * - C2 (plugin OFF fallback): `applies: (s) => !s.withEcc && <track>`. 19개.
   * - C3 (modified or 별개 source): `applies: <track only>` (withEcc 무관 항상 install). 3개.
   *
   * 분류 표 SSOT: docs/PRD/v26-58-cherry-pick-plugin-gating.md §6.
   */
  withEcc?: boolean;
  /**
   * v26.87.0 — 선택된 내부 dev-method skill id 집합 (uzys 1st-party, repo-bundled).
   * installer 가 `DEV_METHOD_SKILL_IDS` 를 `isAssetSelected` 로 필터해 채운다 — 즉
   * track(has-dev-track) 기본 + wizard uncheck / `--without <id>` (forceExclude) 반영.
   * buildManifest 의 skill-dir copy 가 이 목록에 포함된 id 만 게이팅한다.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
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

// v26.107.0 (ADR-036, 라이프사이클 자산화 ①) — doc-governance: SSOT 위계 + "merge = 코드 +
//   추적 동기화" 의무. 실무 관행의 일반화. 문서 규약은 전 트랙 공통.
// v26.121.0 — no-false-ship 은 이 저장소 로컬 룰이었고 배포되지 않았다(사용자 결정으로 배송).
// COMMON 인 이유: "검증한 것만 주장한다"는 코드를 출하할 때만이 아니라 모든 보고에 걸린다.
const COMMON_RULES = [
  "git-policy",
  "change-management",
  "gates-taxonomy",
  "doc-governance",
  "no-false-ship",
];
const DEV_RULES = ["test-policy", "ship-checklist", "code-style", "error-handling"];
// v26.109.0 (ADR-038, 라이프사이클 자산화 ③) — benchmark-parity: 레퍼런스 실측 → gap.md →
//   완결성 루프. capture 수단의 SSOT 인 playwright-launch 와 짝으로만 성립하므로 UI 트랙 한정.
const UI_RULES = ["design-workflow", "playwright-launch", "benchmark-parity"];

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

// v26.58.0 — ECC cherry-pick × plugin gating. ADR-019.
// 본 프로젝트 (always): reviewer, data-analyst, strategist
// ECC cherry-pick C2 (plugin OFF 시 fallback — opt-out gating, !s.withEcc):
//   code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver
const CORE_AGENTS = ["reviewer", "data-analyst", "strategist"];
const CORE_AGENTS_ECC = ["code-reviewer", "security-reviewer"];

const DEV_AGENTS = ["plan-checker"];
const DEV_AGENTS_ECC = ["silent-failure-hunter", "build-error-resolver"];

/** Hooks installed for every project (parity with setup-harness.sh L815-826). */
export const ALWAYS_HOOKS = [
  "session-start.sh",
  "protect-files.sh",
  "mcp-pre-exec.sh",
  "spec-drift-check.sh",
  "checkpoint-snapshot.sh",
];

// v26.58.0 — ECC cherry-pick × plugin gating. ADR-019.
const COMMON_SKILL_DIRS = ["north-star", "gh-issue-workflow"];
// C2 (plugin OFF fallback, opt-out): strategic-compact.
// v26.121.0 — continuous-learning-v2 가 C3 → C2. 우리 판본이 upstream 에서 agents/(관측을
// instinct 로 바꾸는 분석기)를 뺀 진부분집합이었고, 그래서 "plugin 으로 갈음 불가"라는 C3 근거가
// 뒤집혀 있었다 — 갈음 불가의 내용이 기능 제거였다. upstream 전체를 복원해 동일해졌으므로
// (lock modified:false) plugin ON 이면 비켜서는 것이 맞다. 데몬은 upstream 기본값대로 꺼져 있다
// (config.json observer.enabled=false) — 켜면 백그라운드에서 claude 를 주기 호출하므로 사용자 선택.
const COMMON_SKILL_DIRS_ECC = ["strategic-compact", "continuous-learning-v2"];
// C3 (modified=true — plugin 으로 갈음 불가, 항상 install). deep-research = v26.114.0
// 리서치 원장(confirmed/killed + caveat) 주입, ADR-042.
const MODIFIED_COMMON_SKILL_DIRS = ["deep-research"];

const DEV_SKILL_DIRS: string[] = [];
const DEV_SKILL_DIRS_ECC = ["agent-introspection-debugging"];
// C3 (modified=true): plugin 으로 갈음 불가, dev 트랙 항상 install.
// verification-loop = v26.113.0 verdict 어휘(ADR-041) / eval-harness = v26.114.0 eval spec
// 아티팩트 계약(C·R ID·baseline·Test Command·Status, ADR-042).
const MODIFIED_DEV_SKILL_DIRS = ["verification-loop", "eval-harness"];

/**
 * C3 로 분류된 ECC cherry-pick 스킬 전체 (수정본 — plugin 으로 갈음 불가).
 * `.dev-references/cherrypicks.lock` 의 `modified: true` 와 1:1 이어야 한다 — lock 이
 * false 로 남으면 `sync-cherrypicks.sh --apply` 의 rsync --delete 가 로컬 수정을 조용히
 * 덮어쓴다. 정합은 tests/vnv-verdict.test.ts 가 강제한다. ADR-041.
 */
export const MODIFIED_ECC_SKILL_DIRS = [...MODIFIED_COMMON_SKILL_DIRS, ...MODIFIED_DEV_SKILL_DIRS];

const UI_SKILL_DIRS = ["ui-visual-review"];
const UI_SKILL_DIRS_ECC = ["e2e-testing"];

// python-* skills (data|csr-fastapi|full) — C2 (plugin OFF fallback).
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

  // ecc: commands — v26.58.0 opt-out gating (BREAKING vs v26.55.0). ADR-019.
  // C2 — plugin OFF 시만 cherry-pick (plugin ON 이면 ecc plugin 의 /ecc:e2e, /ecc:eval, /ecc:harness-audit 사용).
  m.push({
    source: "commands/ecc",
    target: ".claude/commands/ecc",
    type: "dir",
    applies: (s) => !s.withEcc,
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
  // v26.58.0 — Agents (ECC cherry-pick). ADR-019. C2: plugin OFF 시만 install (opt-out).
  for (const a of CORE_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc,
    });
  }
  for (const a of DEV_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks),
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
  // v26.58.0 — Common skill dirs (ECC cherry-pick). ADR-019. C2: plugin OFF 시만 install (opt-out).
  for (const sd of COMMON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc,
    });
  }
  // v26.58.0 — C3 (modified=true). plugin 으로 갈음 불가, 항상 install. ADR-019.
  for (const sd of MODIFIED_COMMON_SKILL_DIRS) {
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
  // v26.87.0 — internal bundled skills (uzys 1st-party templates: dev-method + opt-in advisors,
  // v26.95.0). Whole-dir copy so sidecar files ship too (e.g. gemini-consult/scripts/gemini-ask.sh).
  // Gated on `selectedInternalSkills` (installer computes it via isAssetSelected) — NOT track alone —
  // so a wizard uncheck / `--without <id>` drops the copy, and opt-in ones copy only when selected.
  for (const sd of INTERNAL_BUNDLED_SKILL_IDS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => (s.selectedInternalSkills ?? []).includes(sd),
    });
  }
  // v26.58.0 — python-* / DEV_SKILL_DIRS / UI_SKILL_DIRS 중 ECC 출처는 opt-out gating. ADR-019. C2.
  for (const sd of PYTHON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && anyTrack(s.tracks, "data|csr-fastapi|full"),
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
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks),
    });
  }
  // C3 (modified=true). plugin 으로 갈음 불가 — verdict 어휘는 ECC plugin 판에 없다. ADR-041.
  for (const sd of MODIFIED_DEV_SKILL_DIRS) {
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
  for (const sd of UI_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && hasUiTrack(s.tracks),
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
