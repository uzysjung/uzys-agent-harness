// prompts.ts is a thin adapter over @clack/prompts. It deliberately contains
// no transformation logic — interactive.ts owns the business rules. This file
// is excluded from coverage in vitest.config.ts (justification at exclude line).

import {
  cancel,
  confirm,
  groupMultiselect,
  intro,
  isCancel,
  multiselect,
  outro,
  select,
} from "@clack/prompts";
import type { Category } from "./categories.js";
import { CATEGORY_TITLES } from "./categories.js";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
import { EXTERNAL_ASSETS } from "./external-assets.js";
import { buildRouterChoices, type RouterAction, summarizeState } from "./router.js";
import type { DetectedInstall } from "./state.js";
import { type CliBase, type CliTargets, type OptionFlags, TRACKS, type Track } from "./types.js";

export interface Prompts {
  intro: (msg: string) => void;
  outro: (msg: string) => void;
  cancel: (msg: string) => void;

  selectTracks: (initial?: Track[]) => Promise<Track[] | null>;
  selectOptionKeys: (
    initial?: ReadonlyArray<keyof OptionFlags>,
  ) => Promise<Array<keyof OptionFlags> | null>;
  /** v0.7.0 — single select → multiselect (3 base 체크박스). default `["claude"]`. */
  selectCli: (initial?: CliTargets) => Promise<CliTargets | null>;
  selectAction: (state: DetectedInstall) => Promise<RouterAction | null>;
  confirmInstall: (summary: string) => Promise<boolean | null>;
  /**
   * v26.47.0 (Phase C full) — Step 2 External Asset multiselect (1-tier).
   * 카테고리별 그룹화 + 추천 ✓ 미리 체크 + 출처 라벨.
   * v26.52.0 — 2-tier navigator (selectAssetCategory + selectAssetsInCategory) 로 대체.
   * 본 1-tier 함수는 호환 유지 (CI / non-interactive 또는 fallback).
   */
  selectExternalAssets: (
    initialChecked: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<string> | null>;

  /**
   * v26.52.0 — Step 4 (a) Category navigator. SPEC: docs/specs/step-4-category-navigator.md
   * 7 카테고리 + "Proceed →" 항목. 각 카테고리에 [N/M ✓] 진행률 표시.
   * 결과: Category 선택 → sub-prompt 진입 / "proceed" → confirm step / null → back to cli.
   */
  selectAssetCategory: (
    counts: ReadonlyArray<{ category: Category; selected: number; total: number }>,
  ) => Promise<Category | "proceed" | null>;

  /**
   * v26.52.0 — Step 4 (b) Sub-prompt. 카테고리 내 자산 multiselect.
   * 결과: 카테고리 내 새 선택 asset id 배열. ESC → null (navigator 복귀).
   */
  selectAssetsInCategory: (
    category: Category,
    initialChecked: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<string> | null>;
}

const TRACK_LABELS: Record<Track, string> = {
  tooling: "tooling — Bash + Markdown meta-project",
  "csr-supabase": "csr-supabase — Vite + React + Supabase",
  "csr-fastify": "csr-fastify — Vite + React + Fastify",
  "csr-fastapi": "csr-fastapi — Vite + React + FastAPI",
  "ssr-htmx": "ssr-htmx — htmx + FastAPI",
  "ssr-nextjs": "ssr-nextjs — Next.js (App Router)",
  data: "data — Python data / DuckDB / PySide6",
  executive: "executive — proposals / DD / pitch (no agent-skills)",
  full: "full — all dev capabilities",
  "project-management": "project-management — PM / Scrum / Jira / Confluence",
  "growth-marketing": "growth-marketing — Growth / Marketing / Content",
};

interface OptionDef {
  key: keyof OptionFlags;
  label: string;
  hint: string;
  /** v26.45.0 — Category grouping for Step 2 UI. */
  category: Category;
  /** v26.45.0 — Source label shown in `[source]` form. */
  source: string;
}

const OPTION_DEFS: ReadonlyArray<OptionDef> = [
  {
    key: "withTauri",
    category: "frontend",
    source: "본 프로젝트",
    label: "Tauri desktop rule",
    hint: "CSR / full tracks",
  },
  {
    key: "withGsd",
    category: "workflow",
    source: "get-shit-done-cc",
    label: "GSD orchestrator",
    hint: "Large-project agent coordination",
  },
  {
    key: "withAddyAgentSkills",
    category: "workflow",
    source: "addyosmani",
    label: "addy agent-skills",
    hint: "general dev skill suite · /spec /plan /build slash (no namespace)",
  },
  {
    key: "withUzysHarness",
    category: "workflow",
    source: "본 프로젝트",
    label: "uzys-harness 6-Gate workflow",
    hint: "/uzys:spec /uzys:plan /uzys:build /uzys:test /uzys:review /uzys:ship · v26.44.0 opt-in",
  },
  {
    key: "withSuperpowers",
    category: "workflow",
    source: "obra / anthropics 공식",
    label: "superpowers",
    hint: "agentic skills framework · /spec /plan /build slash (no namespace)",
  },
  {
    key: "withEcc",
    category: "ecc-suite",
    source: "affaan-m",
    label: "ECC plugin (project-scoped)",
    hint: "everything-claude-code",
  },
  {
    key: "withPrune",
    category: "ecc-suite",
    source: "본 프로젝트",
    label: "Prune ECC items beyond curated 89",
    hint: "Implies --with-ecc",
  },
  {
    key: "withTob",
    category: "dev-tools",
    source: "trailofbits",
    label: "Trail of Bits security plugin",
    hint: "differential security review",
  },
  {
    key: "withKarpathyHook",
    category: "dev-tools",
    source: "alirezarezvani",
    label: "karpathy-coder pre-commit hook",
    hint: "Claude Code Write|Edit gate · Python 3 권장 · 비차단 (warn-only)",
  },
  // v26.46.0 — withCodexPrompts entry removed from interactive options.
  // cli=codex 선택 시 default ON. opt-out 은 --no-codex-prompts CLI flag.
];

/** Category render order in Step 2 group multiselect. */
const CATEGORY_ORDER: ReadonlyArray<Category> = [
  "frontend",
  "backend",
  "data",
  "business",
  "dev-tools",
  "workflow",
  "ecc-suite",
];

const CLI_BASE_LABELS: Record<CliBase, string> = {
  claude: "Claude Code",
  codex: "Codex (OpenAI)",
  opencode: "OpenCode (anomalyco)",
};

export const defaultPrompts: Prompts = {
  intro: (msg) => intro(msg),
  outro: (msg) => outro(msg),
  cancel: (msg) => cancel(msg),

  selectTracks: async (initial) => {
    const result = await multiselect({
      message: "Select Track(s) (Space to toggle, Enter to confirm):",
      options: TRACKS.map((t) => ({ value: t, label: TRACK_LABELS[t] })),
      ...(initial ? { initialValues: initial } : {}),
      required: true,
    });
    return isCancel(result) ? null : (result as Track[]);
  },

  selectOptionKeys: async (initial) => {
    // v26.45.0 — groupMultiselect 카테고리별 그룹화 + [source] 라벨.
    const groups: Record<
      string,
      Array<{ value: keyof OptionFlags; label: string; hint: string }>
    > = {};
    for (const cat of CATEGORY_ORDER) {
      const entries = OPTION_DEFS.filter((o) => o.category === cat);
      if (entries.length === 0) continue;
      groups[CATEGORY_TITLES[cat]] = entries.map((o) => ({
        value: o.key,
        label: `${o.label}  [${o.source}]`,
        hint: o.hint,
      }));
    }
    const result = await groupMultiselect({
      message: "Optional features (Space to toggle, Enter to skip):",
      options: groups,
      ...(initial ? { initialValues: [...initial] } : {}),
      required: false,
    });
    return isCancel(result) ? null : (result as Array<keyof OptionFlags>);
  },

  selectCli: async (initial) => {
    // v0.7.0 — multiselect (3 base 체크박스). default ["claude"]. required: true.
    const initialValues: CliBase[] = initial && initial.length > 0 ? [...initial] : ["claude"];
    const result = await multiselect({
      message: "Target CLI(s) (Space to toggle, Enter to confirm):",
      options: [
        { value: "claude" as const, label: CLI_BASE_LABELS.claude },
        { value: "codex" as const, label: CLI_BASE_LABELS.codex },
        { value: "opencode" as const, label: CLI_BASE_LABELS.opencode },
      ],
      initialValues,
      required: true,
    });
    if (isCancel(result)) return null;
    // sorted (claude → codex → opencode 순). cli-targets.ts SSOT.
    return [...(result as CliBase[])].sort(
      (a, b) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b],
    );
  },

  selectAction: async (state) => {
    const result = await select({
      message: summarizeState(state),
      options: buildRouterChoices(state).map((c) => {
        const label = c.enabled ? c.label : `${c.label} [disabled]`;
        return c.hint ? { value: c.value, label, hint: c.hint } : { value: c.value, label };
      }),
    });
    return isCancel(result) ? null : (result as RouterAction);
  },

  confirmInstall: async (summary) => {
    const result = await confirm({
      message: `${summary}\n\nProceed?`,
      initialValue: true,
    });
    return isCancel(result) ? null : result;
  },

  selectAssetCategory: async (counts) => {
    const options = counts.map((c) => ({
      value: c.category,
      label: `${CATEGORY_TITLES[c.category]}  [${c.selected}/${c.total} ✓]`,
    }));
    const result = await select({
      message: "External Assets — pick category to edit (or Proceed →):",
      options: [...options, { value: "proceed" as const, label: "─────────── Proceed → confirm" }],
    });
    return isCancel(result) ? null : (result as Category | "proceed");
  },

  selectAssetsInCategory: async (category, initialChecked) => {
    const entries = EXTERNAL_ASSETS.filter((a) => a.category === category);
    const result = await multiselect({
      message: `${CATEGORY_TITLES[category]} (Space to toggle, Enter to confirm. ESC to cancel):`,
      options: entries.map((a) => ({
        value: a.id,
        label: `${a.id}  [${a.source}]`,
        hint: a.description,
      })),
      initialValues: [...initialChecked],
      required: false,
    });
    return isCancel(result) ? null : (result as ReadonlyArray<string>);
  },

  selectExternalAssets: async (initialChecked) => {
    // v26.47.0 — Phase C full. EXTERNAL_ASSETS 를 카테고리별로 그룹화, 추천 ✓ 미리 체크.
    const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};
    for (const cat of CATEGORY_ORDER) {
      const entries = EXTERNAL_ASSETS.filter((a) => a.category === cat);
      if (entries.length === 0) continue;
      groups[CATEGORY_TITLES[cat]] = entries.map((a) => ({
        value: a.id,
        label: `${a.id}  [${a.source}]`,
        hint: a.description,
      }));
    }
    const result = await groupMultiselect({
      message: "External Assets (Space to toggle, Enter to confirm. ✓ = preset 추천):",
      options: groups,
      initialValues: [...initialChecked],
      required: false,
    });
    return isCancel(result) ? null : (result as ReadonlyArray<string>);
  },
};
