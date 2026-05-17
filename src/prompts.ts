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
import { CATEGORIES as CATEGORY_ORDER, CATEGORY_TITLES, type Category } from "./categories.js";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
import { EXTERNAL_ASSETS } from "./external-assets.js";
import { buildRouterChoices, type RouterAction, summarizeState } from "./router.js";
import type { DetectedInstall } from "./state.js";
import { type CliBase, type CliTargets, type OptionFlags, TRACKS, type Track } from "./types.js";

/**
 * v26.54.0 — All-in-one install-targets value scheme.
 * groupMultiselect 의 단일 string value 에 두 source 통합:
 *   - `option:<key>` → OPTION_DEFS 의 manifest-영향 build option (현재: withTauri, withUzysHarness)
 *   - `asset:<id>` → EXTERNAL_ASSETS 의 외부 자산
 * 다른 OptionFlags 항목 (withGsd, withEcc, withPrune, withTob, withKarpathyHook,
 * withAddyAgentSkills, withSuperpowers) 은 EXTERNAL_ASSETS 에 1:1 자산이 있어
 * 자산 체크 → userOverride.forceInclude 로 처리. UI 중복 표시 없음.
 */
export type InstallTargetId = `option:${keyof OptionFlags}` | `asset:${string}`;

export interface Prompts {
  intro: (msg: string) => void;
  outro: (msg: string) => void;
  cancel: (msg: string) => void;

  selectTracks: (initial?: Track[]) => Promise<Track[] | null>;
  /** v0.7.0 — single select → multiselect (3 base 체크박스). default `["claude"]`. */
  selectCli: (initial?: CliTargets) => Promise<CliTargets | null>;
  selectAction: (state: DetectedInstall) => Promise<RouterAction | null>;
  confirmInstall: (summary: string) => Promise<boolean | null>;

  /**
   * v26.54.0 — Step 3 (all-in-one). EXTERNAL_ASSETS + 표시-대상 OPTION_DEFS 를
   * 카테고리 그룹화. 추천 ✓ pre-check. ESC → null (silent back).
   */
  selectInstallTargets: (
    initialChecked: ReadonlyArray<InstallTargetId>,
    step: { current: number; total: number },
  ) => Promise<ReadonlyArray<InstallTargetId> | null>;
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
  category: Category;
  source: string;
}

/**
 * v26.54.0 — 표시 대상 OPTION_DEFS 축소.
 * EXTERNAL_ASSETS 에 1:1 자산이 있는 OptionFlags 는 UI 에서 자산 노출만 (중복 제거).
 * 본 list 의 옵션은 manifest 정책 파일 매핑에 직접 영향 (자산 X).
 * - withTauri → manifest 의 tauri-desktop rule (자산 매핑 없음)
 * - withUzysHarness → manifest 의 uzys-* slash commands (자산 매핑 없음)
 * 제외: withGsd, withEcc, withPrune, withTob, withKarpathyHook, withAddyAgentSkills,
 *       withSuperpowers (자산 1:1 매핑 → 자산 체크로 갈음)
 * 제외 (D16/자동): withCodexSkills, withCodexTrust, withCodexPrompts
 */
export const VISIBLE_OPTION_DEFS: ReadonlyArray<OptionDef> = [
  {
    key: "withTauri",
    category: "frontend",
    source: "본 프로젝트",
    label: "Tauri desktop rule (option)",
    hint: "CSR / full tracks · manifest rule 매핑",
  },
  {
    key: "withUzysHarness",
    category: "workflow",
    source: "본 프로젝트",
    label: "uzys-harness 6-Gate workflow (option)",
    hint: "/uzys:spec /uzys:plan /uzys:build /uzys:test /uzys:review /uzys:ship",
  },
];

const CLI_BASE_LABELS: Record<CliBase, string> = {
  claude: "Claude Code",
  codex: "Codex (OpenAI)",
  opencode: "OpenCode (anomalyco)",
};

/**
 * v26.58.1 — Wizard viewport size. clack 의 limitOptions 가 maxItems 안에서만
 * cursor follow + ↕ ... indicator. 미지정 시 Infinity → terminal height 초과 시
 * 위 항목이 scrollback 으로 밀려 selected indicator 안 보임 (사용자 보고된 문제).
 *
 * rowPadding 10 = message line + status footer + safety margin.
 * floor 8 = 너무 작아도 최소한의 viewport 보장.
 */
function viewportItems(itemCount: number): number {
  const rows = process.stdout.rows ?? 24;
  return Math.max(8, Math.min(itemCount, rows - 10));
}

export const defaultPrompts: Prompts = {
  intro: (msg) => intro(msg),
  outro: (msg) => outro(msg),
  cancel: (msg) => cancel(msg),

  selectTracks: async (initial) => {
    // v26.58.1 — maxItems 로 viewport scroll. cursor follow + ↕ ... indicator (clack limitOptions).
    // 단 11 tracks 라 width 30 미만 환경에서만 의미. 그래도 default 안전망.
    const result = await multiselect({
      message: "Step 1/3 — Select Track(s) (Space to toggle, Enter to confirm):",
      options: TRACKS.map((t) => ({ value: t, label: TRACK_LABELS[t] })),
      ...(initial ? { initialValues: initial } : {}),
      maxItems: viewportItems(11),
      required: true,
    });
    return isCancel(result) ? null : (result as Track[]);
  },

  selectCli: async (initial) => {
    // v0.7.0 — multiselect (3 base 체크박스). default ["claude"]. required: true.
    const initialValues: CliBase[] = initial && initial.length > 0 ? [...initial] : ["claude"];
    const result = await multiselect({
      message: "Step 2/3 — Target CLI(s) (Space to toggle, Enter to confirm. ESC to go back):",
      options: [
        { value: "claude" as const, label: CLI_BASE_LABELS.claude },
        { value: "codex" as const, label: CLI_BASE_LABELS.codex },
        { value: "opencode" as const, label: CLI_BASE_LABELS.opencode },
      ],
      initialValues,
      required: true,
    });
    if (isCancel(result)) return null;
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

  selectInstallTargets: async (initialChecked, step) => {
    // v26.54.0 — Step 3 all-in-one. EXTERNAL_ASSETS + VISIBLE_OPTION_DEFS 카테고리 그룹화.
    // v26.56.0 (F4) — 카테고리 헤더에 selected count [N/M ✓] 표시. viewport 외 selected 가시화.
    //   clack 한계: dynamic count update X. 초기 selected count 만 표시 (가시성 ~80%).
    const initialSet = new Set<string>(initialChecked);
    const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};
    for (const cat of CATEGORY_ORDER) {
      const items: Array<{ value: string; label: string; hint?: string }> = [];
      // 옵션 먼저 (상단)
      for (const o of VISIBLE_OPTION_DEFS.filter((d) => d.category === cat)) {
        items.push({
          value: `option:${o.key}`,
          label: `${o.label}  [${o.source}]`,
          hint: o.hint,
        });
      }
      // 그 다음 자산
      for (const a of EXTERNAL_ASSETS.filter((x) => x.category === cat)) {
        items.push({
          value: `asset:${a.id}`,
          label: `${a.id}  [${a.source}]`,
          hint: a.description,
        });
      }
      if (items.length === 0) continue;
      const selectedInCat = items.filter((it) => initialSet.has(it.value)).length;
      const header = `${CATEGORY_TITLES[cat]}  [${selectedInCat}/${items.length} ✓ default]`;
      groups[header] = items;
    }
    // v26.58.1 — maxItems 로 viewport scroll fix. cursor 가 항상 visible viewport 안에 있도록
    // clack 의 limitOptions 가 자동 follow + ↕ ... indicator. 이전 'height 30+ 권장' 한계 해제.
    // Note: clack 1.3 type def 가 GroupMultiSelectOptions 에 maxItems 누락. runtime 은 정상
    //   (limitOptions 가 t.maxItems 참조). 향후 clack upgrade 시 cast 제거.
    const totalDefault = initialSet.size;
    const totalItems = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
    const groupOpts = {
      message: `Step ${step.current}/${step.total} — What will be installed  (default ✓ ${totalDefault}/${totalItems}. Space toggle · Enter confirm · ESC back):`,
      options: groups,
      initialValues: [...initialChecked],
      maxItems: viewportItems(totalItems),
      required: false,
    } as Parameters<typeof groupMultiselect>[0];
    const result = await groupMultiselect(groupOpts);
    return isCancel(result) ? null : (result as ReadonlyArray<InstallTargetId>);
  },
};
