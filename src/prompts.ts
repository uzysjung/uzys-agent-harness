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
import { CATEGORIES, CATEGORY_TITLES, type Category } from "./categories.js";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
import { assetTrustTier, EXTERNAL_ASSETS } from "./external-assets.js";
import { buildRouterChoices, type RouterAction, summarizeState } from "./router.js";
import type { DetectedInstall } from "./state.js";
import {
  type CliBase,
  type CliTargets,
  type InstallScope,
  type OptionFlags,
  TRACKS,
  type Track,
} from "./types.js";
import { stepLabel, type WizardStep } from "./wizard-steps.js";

/**
 * v26.54.0 — All-in-one install-targets value scheme.
 * groupMultiselect 의 단일 string value 에 두 source 통합:
 *   - `option:<key>` → OPTION_DEFS 의 manifest-영향 build option (현재: withTauri, withUzysHarness)
 *   - `asset:<id>` → EXTERNAL_ASSETS 의 외부 자산
 * 다른 OptionFlags 항목 (withGsd, withEcc, withPrune, withTob, withKarpathyHook,
 * withAddyAgentSkills, withSuperpowers, withWshobsonAgents, withOpenspec, withBmad) 은
 * EXTERNAL_ASSETS 에 1:1 자산이 있어
 * 자산 체크 → userOverride.forceInclude 로 처리. UI 중복 표시 없음.
 */
export type InstallTargetId = `option:${keyof OptionFlags}` | `asset:${string}`;

export interface Prompts {
  intro: (msg: string) => void;
  outro: (msg: string) => void;
  cancel: (msg: string) => void;

  /**
   * v26.65.0 — step optional 두 번째 인자. 호출자가 `WIZARD.TRACKS` 전달 시 message 에
   * "Step N/M — Select Track(s)" 형식 indicator 자동 삽입. 미전달 시 prefix 없이 raw label.
   */
  selectTracks: (initial?: Track[], step?: WizardStep) => Promise<Track[] | null>;
  /** v0.7.0 — single select → multiselect (3 base 체크박스). default `["claude"]`. */
  selectCli: (initial?: CliTargets, step?: WizardStep) => Promise<CliTargets | null>;
  selectAction: (state: DetectedInstall) => Promise<RouterAction | null>;
  /**
   * v26.64.0 (ADR-020) — Installation scope 선택. Default = "project" (pre-selected).
   * Global 은 사용자 명시 opt-in. null = silent back.
   */
  selectScope: (initial?: InstallScope, step?: WizardStep) => Promise<InstallScope | null>;
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
 * v26.54.0 — 표시 대상 OPTION_DEFS.
 * v26.81.0 (ADR-022) — **빈 배열로 소멸**. 마지막 2개(withTauri/withUzysHarness)가 내부
 * 자산(tauri-desktop/uzys-harness — EXTERNAL_ASSETS `kind:"internal"`)으로 흡수돼 wizard 의
 * `option:` 특례가 사라짐. 자산 선택은 전부 `asset:<id>` 경로. 잔존 동작 옵션(D16 글로벌
 * 4종/karpathy hook/prune)은 wizard 미노출 (CLI `--with-*` 동작 플래그 전용 — 기존과 동일).
 */
export const VISIBLE_OPTION_DEFS: ReadonlyArray<OptionDef> = [];

const CLI_BASE_LABELS: Record<CliBase, string> = {
  claude: "Claude Code",
  codex: "Codex (OpenAI)",
  opencode: "OpenCode (anomalyco)",
  antigravity: "Antigravity (Google)",
};

/**
 * v26.78.1 — Step 3 wizard page layout (SSOT). 카테고리를 페이지로 묶어 clack
 * groupMultiselect 의 maxItems 한계(페이지당 옵션 ≤ ~30)를 우회.
 *
 * ⚠️ drift 가드 (no-false-ship): 모든 Category 는 정확히 한 페이지에 등장해야 한다.
 * 누락 시 해당 카테고리 자산이 wizard 에서 선택 불가가 되어 "출하 거짓 광고"가 된다
 * (v26.78.0 understanding 누락 회귀 — pages 가 selectInstallTargets 안에 하드코딩되어
 * CATEGORIES 추가와 drift). 아래 assertPagesCoverAllCategories 가 모듈 로드 시점에
 * 강제 — 신규 카테고리 미배치 시 즉시 throw. (tests/wizard-page-parity.test.ts 가 이중 가드)
 *
 * 페이지 묶음:
 *   Page 1: Dev domain  — frontend + backend + dev-tools + data + understanding
 *   Page 2: Business    — business (documents)
 *   Page 3: Workflow/ECC — workflow + ecc-suite
 */
export interface InstallTargetPage {
  label: string;
  cats: ReadonlyArray<Category>;
}

export const INSTALL_TARGET_PAGES: ReadonlyArray<InstallTargetPage> = [
  {
    label: "Dev (Frontend · Backend · Dev Tools · Data · Understanding)",
    cats: ["frontend", "backend", "dev-tools", "data", "understanding"],
  },
  { label: "Business (PM · Executive · Documents)", cats: ["business"] },
  { label: "Workflow & ECC Suite", cats: ["workflow", "ecc-suite"] },
];

/**
 * 모든 Category 가 정확히 한 페이지에 등장하는지 모듈 로드 시 검증.
 * 누락(미배치) 또는 중복(2개 페이지)이면 throw — 값싼 fail-loud pre-flight.
 */
function assertPagesCoverAllCategories(pages: ReadonlyArray<InstallTargetPage>): void {
  const counts = new Map<Category, number>();
  for (const page of pages) {
    for (const cat of page.cats) counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const missing = CATEGORIES.filter((c) => !counts.has(c));
  const duplicated = CATEGORIES.filter((c) => (counts.get(c) ?? 0) > 1);
  if (missing.length > 0 || duplicated.length > 0) {
    throw new Error(
      `INSTALL_TARGET_PAGES drift vs CATEGORIES — missing=[${missing.join(", ")}] ` +
        `duplicated=[${duplicated.join(", ")}]. 모든 카테고리는 정확히 한 페이지에 배치해야 한다 ` +
        `(no-false-ship: wizard 미노출 = 거짓 광고).`,
    );
  }
}

assertPagesCoverAllCategories(INSTALL_TARGET_PAGES);

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

  selectTracks: async (initial, step) => {
    // v26.65.0 — step indicator SSOT (wizard-steps.ts). 6-step 통합 (1 tracks · 2 cli · 3 targets · 4 scope · 5 confirm · 6 installing).
    const result = await multiselect({
      message: stepLabel(step, "Select Track(s)"),
      options: TRACKS.map((t) => ({ value: t, label: TRACK_LABELS[t] })),
      ...(initial ? { initialValues: initial } : {}),
      maxItems: viewportItems(11),
      required: true,
    });
    return isCancel(result) ? null : (result as Track[]);
  },

  selectCli: async (initial, step) => {
    const initialValues: CliBase[] = initial && initial.length > 0 ? [...initial] : ["claude"];
    const result = await multiselect({
      message: stepLabel(step, "Target CLI(s)"),
      options: [
        { value: "claude" as const, label: CLI_BASE_LABELS.claude },
        { value: "codex" as const, label: CLI_BASE_LABELS.codex },
        { value: "opencode" as const, label: CLI_BASE_LABELS.opencode },
        { value: "antigravity" as const, label: CLI_BASE_LABELS.antigravity },
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
        // disabled:true → clack 이 cursor skip + strikethrough (선택 자체 차단).
        return {
          value: c.value,
          label,
          ...(c.hint ? { hint: c.hint } : {}),
          ...(c.enabled ? {} : { disabled: true }),
        };
      }),
    });
    return isCancel(result) ? null : (result as RouterAction);
  },

  /**
   * v26.64.0 (ADR-020) — Installation scope select. Default Project (D16 — no global write).
   * Global 은 사용자 명시 opt-in 시에만.
   */
  selectScope: async (initial = "project", step) => {
    const result = await select({
      message: stepLabel(step, "Installation scope"),
      initialValue: initial,
      options: [
        {
          value: "project",
          label: "Project",
          hint: "Install in current directory (committed with your project)",
        },
        {
          value: "global",
          label: "Global",
          hint: "Write to ~/.claude/, ~/.codex/, npm -g (shared across all projects)",
        },
      ],
    });
    return isCancel(result) ? null : (result as InstallScope);
  },

  confirmInstall: async (summary) => {
    const result = await confirm({
      message: `${summary}\n\nProceed?`,
      initialValue: true,
    });
    return isCancel(result) ? null : result;
  },

  selectInstallTargets: async (initialChecked, step, recap) => {
    // v26.62.2 — groupMultiselect 복귀 + page paginate.
    //   v26.62.1 에서 multiselect + disabled separator 시도 → clack 가 disabled option 에
    //   체크박스 강제 + dim/strikethrough 효과 → 카테고리 헤더가 "옵션 같지만 선택 불가"
    //   처럼 보여 사용자 보고. groupMultiselect 의 group header 는 라이브러리에서 본래
    //   설명 라인 형태로 자연 표시 → 시각 명료.
    //
    //   maxItems 한계 (GroupMultiSelectPrompt 미지원) 는 page 묶음으로 cover:
    //   한 page 안 옵션 ≤ ~30 → 사용자 iTerm2 (30+ rows) 환경에서 fit. 매우 작은 terminal
    //   (< 25 rows) 한계는 follow-up.
    //
    // 페이지 정의 = 모듈 스코프 INSTALL_TARGET_PAGES (SSOT, 카테고리 전수 가드됨).
    const pages = INSTALL_TARGET_PAGES;
    const initialSet = new Set<string>(initialChecked);
    const collected = new Set<string>(initialChecked);

    const buildPageGroups = (cats: ReadonlyArray<Category>) => {
      const groups: Record<string, Array<{ value: string; label: string; hint?: string }>> = {};
      const flatItems: Array<{ value: string; label: string; hint?: string }> = [];
      for (const cat of cats) {
        const items: Array<{ value: string; label: string; hint?: string }> = [];
        for (const o of VISIBLE_OPTION_DEFS.filter((d) => d.category === cat)) {
          items.push({
            value: `option:${o.key}`,
            // v26.62.3 — group header 와 옵션 사이 시각 hierarchy 강화. label prefix 4 space.
            label: `    ${o.label}  [${o.source}]`,
            hint: o.hint,
          });
        }
        // v26.71.0 (PRD v26-71) — tier 우선 정렬 (official → vetted → experimental) + 배지.
        const tierOrder = { official: 0, vetted: 1, experimental: 2 } as const;
        const catAssets = [...EXTERNAL_ASSETS.filter((x) => x.category === cat)].sort(
          (a, b) => tierOrder[assetTrustTier(a.id)] - tierOrder[assetTrustTier(b.id)],
        );
        for (const a of catAssets) {
          const tier = assetTrustTier(a.id);
          const badge =
            tier === "official"
              ? "  ★ official"
              : tier === "experimental"
                ? "  ⚠ experimental (opt-in)"
                : "";
          items.push({
            value: `asset:${a.id}`,
            label: `    ${a.id}  [${a.source}]${badge}`,
            hint: a.description,
          });
        }
        if (items.length === 0) continue;
        const selectedInCat = items.filter((it) => initialSet.has(it.value)).length;
        const header = `${CATEGORY_TITLES[cat]}  [${selectedInCat}/${items.length} ✓ default]`;
        groups[header] = items;
        flatItems.push(...items);
      }
      return { groups, flatItems };
    };

    const recapLine = recap
      ? `Tracks: ${recap.tracks.join(", ")}  ·  CLIs: ${recap.cli.join(", ")}`
      : "";

    // alt screen for the whole Step 3 loop. page 전환 시 buffer 안에서 redraw.
    process.stdout.write("\x1b[?1049h");
    let resultIds: ReadonlyArray<InstallTargetId> | null = null;
    let aborted = false;
    try {
      let pageIdx = 0;
      while (pageIdx < pages.length) {
        const page = pages[pageIdx];
        if (!page) break;
        const { groups, flatItems } = buildPageGroups(page.cats);
        const selectedNow = flatItems.filter((it) => collected.has(it.value)).map((it) => it.value);
        const pageDefault = flatItems.filter((it) => initialSet.has(it.value)).length;
        const totalSelected = collected.size;
        const message = [
          `Step ${step.current}/${step.total}  ·  Page ${pageIdx + 1}/${pages.length}  ·  ${page.label}`,
          recapLine ? `  ${recapLine}` : "",
          `  Selected so far: ${totalSelected} items  ·  This page default ✓ ${pageDefault}/${flatItems.length}`,
          "  Space toggle · Enter → next · ESC → prev",
        ]
          .filter(Boolean)
          .join("\n");

        const groupOpts = {
          message,
          options: groups,
          initialValues: selectedNow,
          required: false,
          selectableGroups: false,
        } as Parameters<typeof groupMultiselect>[0];
        const result = await groupMultiselect(groupOpts);
        if (isCancel(result)) {
          if (pageIdx === 0) {
            aborted = true; // first page ESC → Step 2 back
            break;
          }
          pageIdx--; // prev page
          continue;
        }
        // update collected: remove page items + add the new selection
        for (const it of flatItems) collected.delete(it.value);
        for (const v of result as ReadonlyArray<string>) collected.add(v);
        pageIdx++;
      }
      if (!aborted) {
        resultIds = [...collected] as ReadonlyArray<InstallTargetId>;
      }
    } finally {
      process.stdout.write("\x1b[?1049l");
    }
    // v26.63.1 — alt screen exit 후 main buffer 에 Step 3 완료 라인 출력. alt buffer
    //   안 동작은 main 에 흔적 0 → Step 1·2·4 사이 Step 3 missing → 사용자 보고.
    //   clack `◇` marker + `│` line 으로 다른 step 과 시각 일관성 유지.
    if (resultIds !== null) {
      process.stdout.write(
        `◇  Step ${step.current}/${step.total} — Install targets  ·  ${resultIds.length} selected\n│\n`,
      );
    }
    return resultIds;
  },
};
