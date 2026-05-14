// prompts.ts is a thin adapter over @clack/prompts. It deliberately contains
// no transformation logic — interactive.ts owns the business rules. This file
// is excluded from coverage in vitest.config.ts (justification at exclude line).

import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
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

const OPTION_DEFS: ReadonlyArray<{ key: keyof OptionFlags; label: string; hint: string }> = [
  { key: "withTauri", label: "Tauri desktop rule", hint: "CSR / full tracks" },
  { key: "withGsd", label: "GSD orchestrator", hint: "Large-project agent coordination" },
  {
    key: "withAddyAgentSkills",
    label: "addy agent-skills (addyosmani/agent-skills)",
    hint: "general dev skill suite · /spec /plan /build slash commands (no namespace)",
  },
  {
    key: "withUzysHarness",
    label: "uzys-harness 6-Gate workflow (본 프로젝트)",
    hint: "/uzys:spec /uzys:plan /uzys:build /uzys:test /uzys:review /uzys:ship · v26.44.0 opt-in",
  },
  {
    key: "withSuperpowers",
    label: "superpowers (obra/superpowers, Anthropic 공식 marketplace)",
    hint: "agentic skills framework · /spec /plan /build slash (no namespace)",
  },
  { key: "withEcc", label: "ECC plugin (project-scoped)", hint: "everything-claude-code" },
  { key: "withPrune", label: "Prune ECC items beyond curated 89", hint: "Implies ECC" },
  { key: "withTob", label: "Trail of Bits security plugin", hint: "CodeQL + Semgrep" },
  {
    key: "withKarpathyHook",
    label: "karpathy-coder pre-commit hook (opt-in)",
    hint: "Claude Code Write|Edit gate · Python 3 권장 · 비차단 (warn-only)",
  },
  {
    key: "withCodexPrompts",
    label: "Codex slash commands (opt-in)",
    hint: "~/.codex/prompts/uzys-*.md 6 file 글로벌 복사 · /uzys-spec slash 등록 · D16 opt-in",
  },
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
    const result = await multiselect({
      message: "Optional features (Space to toggle, Enter to skip):",
      options: OPTION_DEFS.map((o) => ({ value: o.key, label: o.label, hint: o.hint })),
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
};
