// prompts.ts is a thin adapter over @clack/prompts. It deliberately contains
// no transformation logic — interactive.ts owns the business rules. This file
// is excluded from coverage in vitest.config.ts (justification at exclude line).

import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { CATEGORY_TITLES, type Category } from "./categories.js";
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
   * v26.61.0 — recap (tracks/cli) 추가. alt screen 안에서 동작 — terminal scrollback
   *   본질 차단 → wizard scroll 시 cursor highlight 항상 visible.
   */
  selectInstallTargets: (
    initialChecked: ReadonlyArray<InstallTargetId>,
    step: { current: number; total: number },
    recap?: { tracks: ReadonlyArray<Track>; cli: CliTargets },
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
    source: "this project",
    label: "Tauri desktop rule (option)",
    hint: "CSR / full tracks · manifest rule mapping",
  },
  {
    key: "withUzysHarness",
    category: "workflow",
    source: "this project",
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

  selectInstallTargets: async (initialChecked, step, recap) => {
    // v26.62.0 — 3-page category paginate. 사유:
    //   1. clack GroupMultiSelectOptions 에 maxItems 미지원 (옵션 type 정의 + class
    //      implementation 모두 누락) → groupMultiselect 의 list 가 terminal 보다 길면
    //      cursor highlight viewport 밖으로 빠지는 본질적 한계.
    //   2. multiselect 는 maxItems 정상 지원 → page 안에서도 viewport scroll OK.
    //   3. 한 page 당 ~10-20 옵션 묶음 (사용자 의도 "잘게 쪼개기 회피" — 3 page 만).
    //   4. label prefix 로 카테고리 시각 구분 (group header 대체).
    //
    // 페이지 묶음:
    //   Page 1: Dev domain     — frontend + backend + dev-tools + data
    //   Page 2: Business       — pm + executive + documents
    //   Page 3: Workflow/ECC   — workflow + ecc-suite
    const initialSet = new Set<string>(initialChecked);
    const collected = new Set<string>(initialChecked);

    type PageDef = { label: string; cats: ReadonlyArray<Category> };
    const pages: ReadonlyArray<PageDef> = [
      {
        label: "Dev (Frontend · Backend · Dev Tools · Data)",
        cats: ["frontend", "backend", "dev-tools", "data"],
      },
      { label: "Business (PM · Executive · Documents)", cats: ["business"] },
      { label: "Workflow & ECC Suite", cats: ["workflow", "ecc-suite"] },
    ];

    // v26.62.1 — 카테고리 별 disabled separator option 삽입. clack `disabled: true` 는
    //   "visible but cannot be selected" + cursor navigation 시 skip → group header 시각 유지.
    //   selectable items 만 cursor 가 자연스럽게 이동.
    const buildPageOptions = (cats: ReadonlyArray<Category>) => {
      const items: Array<{ value: string; label: string; hint?: string; disabled?: boolean }> = [];
      for (const cat of cats) {
        const catItems: Array<{ value: string; label: string; hint?: string }> = [];
        for (const o of VISIBLE_OPTION_DEFS.filter((d) => d.category === cat)) {
          catItems.push({
            value: `option:${o.key}`,
            label: `  ${o.label}  [${o.source}]`,
            hint: o.hint,
          });
        }
        for (const a of EXTERNAL_ASSETS.filter((x) => x.category === cat)) {
          catItems.push({
            value: `asset:${a.id}`,
            label: `  ${a.id}  [${a.source}]`,
            hint: a.description,
          });
        }
        if (catItems.length === 0) continue;
        const selectedInCat = catItems.filter((it) => initialSet.has(it.value)).length;
        items.push({
          value: `__sep_${cat}`,
          label: `${CATEGORY_TITLES[cat]}  [${selectedInCat}/${catItems.length} ✓ default]`,
          disabled: true,
        });
        items.push(...catItems);
      }
      return items;
    };

    const recapLine = recap
      ? `Tracks: ${recap.tracks.join(", ")}  ·  CLIs: ${recap.cli.join(", ")}`
      : "";

    // v26.61.0 — alt screen for the whole Step 3 loop. page 전환 시 buffer 안에서 redraw.
    process.stdout.write("\x1b[?1049h");
    try {
      let pageIdx = 0;
      while (pageIdx < pages.length) {
        const page = pages[pageIdx];
        if (!page) break;
        const items = buildPageOptions(page.cats);
        const selectedNow = items.filter((it) => collected.has(it.value)).map((it) => it.value);
        const pageDefault = items.filter((it) => initialSet.has(it.value)).length;
        const totalSelected = collected.size;
        const message = [
          `Step ${step.current}/${step.total}  ·  Page ${pageIdx + 1}/${pages.length}  ·  ${page.label}`,
          recapLine ? `  ${recapLine}` : "",
          `  Selected so far: ${totalSelected} items  ·  This page default ✓ ${pageDefault}/${items.length}`,
          "  Space toggle · Enter → next · ESC → prev",
        ]
          .filter(Boolean)
          .join("\n");

        const result = await multiselect({
          message,
          options: items,
          initialValues: selectedNow,
          maxItems: viewportItems(items.length),
          required: false,
        });
        if (isCancel(result)) {
          if (pageIdx === 0) return null; // first page ESC → Step 2 back
          pageIdx--; // prev page
          continue;
        }
        // update collected: remove page items + add the new selection
        for (const it of items) collected.delete(it.value);
        for (const v of result as ReadonlyArray<string>) collected.add(v);
        pageIdx++;
      }
      return [...collected] as ReadonlyArray<InstallTargetId>;
    } finally {
      process.stdout.write("\x1b[?1049l");
    }
  },
};
