import { BASELINE_PREFIX, listBaselineTargets } from "./baseline-targets.js";
import { formatResidentCostLine, residentCost, summarizeContextCost } from "./context-cost.js";
import { assetReachesCli, EXTERNAL_ASSETS } from "./external-assets.js";
import { readInstallLog } from "./install-log.js";
import type { InstallMode } from "./installer.js";
import { buildManifest } from "./manifest.js";
import {
  finalSelectedAssets,
  groupAssetsByCategory,
  recommendedExternalAssets,
} from "./preset-recommend.js";
import {
  defaultPrompts,
  type InstallTargetId,
  type Prompts,
  VISIBLE_OPTION_DEFS,
} from "./prompts.js";
import { type DetectedInstall, detectInstallState } from "./state.js";
import type { InstallSpec, OptionFlags, Track } from "./types.js";
import { buildUpdateSpec } from "./update-mode.js";
import { stepLabel, WIZARD } from "./wizard-steps.js";

/**
 * v26.54.0 — All-in-one 결과 → option keys + asset id list 분리.
 * `option:<key>` → OptionFlags key
 * `asset:<id>` → EXTERNAL_ASSETS id
 */
export function splitInstallTargets(targets: ReadonlyArray<InstallTargetId>): {
  optionKeys: Array<keyof OptionFlags>;
  assetIds: Array<string>;
  /** 2026-08-16 — 사용자가 **체크한 채로 둔** baseline id. 제외는 이것의 여집합으로 낸다. */
  baselineIds: Array<string>;
} {
  const optionKeys: Array<keyof OptionFlags> = [];
  const assetIds: Array<string> = [];
  const baselineIds: Array<string> = [];
  for (const t of targets) {
    if (t.startsWith("option:")) {
      optionKeys.push(t.slice("option:".length) as keyof OptionFlags);
    } else if (t.startsWith("asset:")) {
      assetIds.push(t.slice("asset:".length));
    } else if (t.startsWith(BASELINE_PREFIX)) {
      baselineIds.push(t);
    }
  }
  return { optionKeys, assetIds, baselineIds };
}

/**
 * 체크 결과 → **제외 목록**. 화면은 "설치할 것"을 체크로 보여주는데 spec 이 받는 것은
 * "빼는 것"이라, 이 뒤집기를 한 곳에 둔다.
 *
 * 전부 체크된 기본 상태에서는 빈 배열이 나온다 — 즉 아무것도 안 고른 사용자의 설치 결과는
 * 이 기능이 생기기 전과 **바이트 단위로 같다**.
 */
export function baselineExcludeFrom(
  offered: ReadonlyArray<{ id: string }>,
  checked: ReadonlyArray<string>,
): string[] {
  const keep = new Set(checked);
  return offered.filter((t) => !keep.has(t.id)).map((t) => t.id);
}

/**
 * v26.81.0 (ADR-022) — 자산 1:1 boolean 13종 삭제 후 잔존 동작 옵션만 매핑.
 *   wizard 의 자산 선택은 전부 `asset:<id>` → userOverride.forceInclude 경로.
 */
export function toOptionFlags(keys: ReadonlyArray<keyof OptionFlags>): OptionFlags {
  const picked = new Set<keyof OptionFlags>(keys);
  return {
    withPrune: picked.has("withPrune"),
    withCodexTrust: picked.has("withCodexTrust"),
  };
}

export interface InteractiveDeps {
  prompts?: Prompts;
  detect?: (projectDir: string) => DetectedInstall;
  isTty?: () => boolean;
  /** v26.125.0 — 설치 상태 주입 (테스트용). 미주입 시 install log 를 읽는다. */
  readInstalled?: (projectDir: string) => InstalledTargetState;
}

/**
 * v26.125.0 — wizard 가 참조하는 설치 상태.
 *
 * `installed` 와 `projectScoped` 를 나누는 이유: global scope 자산까지 사전 체크하면
 * step 4 에서 project 를 고른 순간 **같은 자산이 project 에 한 벌 더 깔린다**. 그래서
 * 표시(마커)는 전부 하고, 사전 체크는 project scope 만 한다.
 */
export interface InstalledTargetState {
  /** 마커를 붙일 자산 id — scope 무관 (설치돼 있다는 사실 자체는 참) */
  installed: ReadonlyArray<string>;
  /** 사전 체크할 자산 id — project scope 만 */
  projectScoped: ReadonlyArray<string>;
}

/** install log → wizard 표시용 설치 상태. 로그가 없으면(최초 설치) 빈 상태. */
export function installedTargetState(projectDir: string): InstalledTargetState {
  const log = readInstallLog(projectDir);
  if (!log) return { installed: [], projectScoped: [] };
  return {
    installed: log.assets.map((a) => a.id),
    projectScoped: log.assets.filter((a) => a.scope !== "global").map((a) => a.id),
  };
}

/**
 * step 3 의 초기 체크 = **트랙 추천 ∪ 이미 설치된 project 자산**.
 *
 * 추천만 쓰면 추천 밖의 설치된 자산이 빈칸으로 보여, 사용자가 "안 깔렸다"고 읽는다.
 * 합집합이므로 중복은 생기지 않는다 (헤더의 `n/m ✓` 카운트가 거짓이 되지 않아야 한다).
 */
export function initialTargetSelection(
  tracks: ReadonlyArray<Track>,
  installedProjectAssetIds: ReadonlyArray<string>,
): InstallTargetId[] {
  const ids = new Set<string>(recommendedExternalAssets(tracks));
  for (const id of installedProjectAssetIds) ids.add(id);
  const assets = [...ids].map((id) => `asset:${id}` as InstallTargetId);
  // 트랙이 고르는 자산은 **전부 체크된 채로** 시작한다. 기본값을 바꾸는 것이 아니라 기본값을
  // 보이게 하는 것이 목적이다 — 아무것도 안 건드리면 설치 결과는 이전과 같다.
  const baseline = listBaselineTargets({ tracks }).map((t) => t.id as InstallTargetId);
  return [...assets, ...baseline];
}

export interface InteractiveResult {
  ok: boolean;
  spec?: InstallSpec;
  mode?: InstallMode;
  reason?: "no-tty" | "cancelled" | "disabled-action" | "exit";
  message?: string;
}

/**
 * v26.54.0 — 3-step wizard. SPEC: docs/specs/v26-54-all-in-one-installer.md
 *
 * Step 1: tracks (ESC = exit + cancel msg)
 * Step 2: cli   (ESC = silent back to tracks)
 * Step 3: install-targets all-in-one (ESC = silent back to cli)
 * confirm prompt (ESC = silent back to targets)
 *
 * 이전 5-step 의 options + 2-tier asset navigator 를 step 3 1 화면 group multiselect 로 흡수.
 */
export async function runInteractive(
  projectDir: string,
  deps: InteractiveDeps = {},
): Promise<InteractiveResult> {
  const prompts = deps.prompts ?? defaultPrompts;
  const detect = deps.detect ?? detectInstallState;
  const isTty = deps.isTty ?? (() => Boolean(process.stdin.isTTY));

  if (!isTty()) {
    return {
      ok: false,
      reason: "no-tty",
      message:
        "Interactive mode requires a TTY. Use `agent-harness install --track <name>` for non-interactive use.",
    };
  }

  prompts.intro("uzys-agent-harness installer");
  const state = detect(projectDir);
  // v26.125.0 — 위저드가 설치 상태를 읽는다. 이전에는 step 3 의 체크가 트랙 추천에서만 나와
  // **이미 깔린 자산이 빈칸으로 보였다** — 사용자가 그 체크박스를 설치 상태로 읽으므로 화면이
  // 거짓을 말한 셈이다. 마커는 표시 전용이고 체크를 풀어도 제거되지 않는다 (제거 = `uninstall`).
  const installed = (deps.readInstalled ?? installedTargetState)(projectDir);

  let initialTracks: Track[] | undefined;
  let mode: InstallMode = "fresh";
  if (state.state === "existing") {
    const action = await prompts.selectAction(state);
    if (action === null) {
      prompts.cancel("Cancelled.");
      return { ok: false, reason: "cancelled" };
    }
    if (action === "exit") {
      prompts.outro("Exiting without changes.");
      return { ok: false, reason: "exit" };
    }
    if (action === "remove") {
      prompts.cancel("Track removal is not automated — manually edit `.claude/`. Aborting.");
      return { ok: false, reason: "disabled-action" };
    }
    if (action === "update") {
      mode = "update";
      // spec 은 `buildUpdateSpec` 단일 출처 — 비대화형 `update` 명령과 같은 것을 쓴다.
      const spec = buildUpdateSpec(projectDir, state.tracks);
      const confirmed = await prompts.confirmInstall(
        `UPDATE policy files only:\n${formatSummary(spec)}`,
      );
      if (!confirmed) {
        prompts.outro("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro("Running update mode...");
      return { ok: true, mode: "update", spec };
    }
    if (action === "add") {
      mode = "add";
      initialTracks = state.tracks;
    } else if (action === "reinstall") {
      mode = "reinstall";
    }
  }

  // v26.64.0 (ADR-020) — scope step 추가. Default "project". Step 3.5 (targets 직후, confirm 직전).
  type Step = "tracks" | "cli" | "targets" | "scope" | "confirm";
  let step: Step = "tracks";
  let tracks: Track[] | null = null;
  let cli: import("./types.js").CliTargets | null = null;
  let targetSelections: ReadonlyArray<InstallTargetId> | null = null;
  let scope: import("./types.js").InstallScope = "project";

  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(tracks ?? initialTracks, WIZARD.TRACKS);
      if (result === null) {
        // Step 1 ESC = exit with cancel message (only step where ESC is "cancel")
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      // preset 변경 감지 → install-targets reset (v26.50 정책 유지)
      if (tracks !== null && !tracksEqual(tracks, result)) {
        targetSelections = null;
      }
      tracks = result;
      step = "cli";
    } else if (step === "cli") {
      const result = await prompts.selectCli(cli ?? ["claude"], WIZARD.CLI);
      if (result === null) {
        step = "tracks"; // silent back
        continue;
      }
      cli = result;
      step = "targets";
    } else if (step === "targets") {
      const initial: InstallTargetId[] =
        targetSelections !== null
          ? [...targetSelections]
          : initialTargetSelection(tracks ?? [], installed.projectScoped);
      // v26.65.0 — step indicator SSOT (wizard-steps.ts). Phase: 3 targets → 4 scope → 5 confirm → 6 install.
      const result = await prompts.selectInstallTargets(initial, WIZARD.TARGETS, {
        tracks: tracks ?? [],
        cli: cli ?? ["claude"],
        installed: installed.installed.map((id) => `asset:${id}`),
      });
      if (result === null) {
        step = "cli"; // silent back
        continue;
      }
      targetSelections = result;
      step = "scope";
    } else if (step === "scope") {
      // v26.64.0 (ADR-020) — Installation scope select. Default "project" (D16).
      const result = await prompts.selectScope(scope, WIZARD.SCOPE);
      if (result === null) {
        step = "targets"; // silent back
        continue;
      }
      scope = result;
      step = "confirm";
    } else {
      // confirm
      // biome-ignore lint/style/noNonNullAssertion: confirm step 도달 = 모든 이전 step 완료 보장
      const finalTracks = tracks!;
      // biome-ignore lint/style/noNonNullAssertion: same as above
      const finalCli = cli!;
      const { optionKeys, assetIds, baselineIds } = splitInstallTargets(targetSelections ?? []);
      const options = toOptionFlags(optionKeys);
      const userOverride =
        targetSelections === null ? undefined : computeUserOverride(finalTracks, assetIds);
      // 제외는 "화면에 낸 것" 대비로 낸다. 화면에 안 낸 자산(`settings.json` 등)은 후보가
      // 아니므로 어떤 조작으로도 빠지지 않는다.
      const baselineExclude =
        targetSelections === null
          ? []
          : baselineExcludeFrom(listBaselineTargets({ tracks: finalTracks }), baselineIds);
      // v26.64.0 (ADR-020) — Confirm summary 에 SCOPE 명시 (사용자 인지 + D16).
      const scopeLabel =
        scope === "global"
          ? "Global (writes to ~/.claude/, ~/.codex/, npm -g)"
          : "Project (current directory only)";
      const summary = `${formatSummary({
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        ...(userOverride ? { userOverride } : {}),
      })}\n  SCOPE     ${scopeLabel}`;
      const confirmed = await prompts.confirmInstall(
        `${stepLabel(WIZARD.CONFIRM, "Confirm")}\n${summary}`,
      );
      if (confirmed === null) {
        step = "scope"; // silent back
        continue;
      }
      if (!confirmed) {
        prompts.outro("Cancelled by user.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro(stepLabel(WIZARD.INSTALL, "Installing..."));
      return {
        ok: true,
        mode,
        spec: {
          tracks: finalTracks,
          options,
          cli: finalCli,
          projectDir,
          scope,
          ...(userOverride ? { userOverride } : {}),
          ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
        },
      };
    }
  }
}

/**
 * Track 배열 동등 비교 (순서 무관). Preset 변경 감지에 사용.
 */
function tracksEqual(a: ReadonlyArray<Track>, b: ReadonlyArray<Track>): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((t, i) => t === sortedB[i]);
}

/**
 * v26.54.0 — Asset 선택 결과 (id 만) 와 preset 추천 비교 → forceInclude / forceExclude.
 * - `recommended - selected` → forceExclude (사용자가 unchecked)
 * - `selected - recommended` → forceInclude (사용자가 추가 선택)
 * 둘 다 비어있으면 undefined (no override).
 */
export function computeUserOverride(
  tracks: ReadonlyArray<Track>,
  assetIds: ReadonlyArray<string>,
): { forceInclude: ReadonlyArray<string>; forceExclude: ReadonlyArray<string> } | undefined {
  const recommended = new Set(recommendedExternalAssets(tracks));
  const selected = new Set(assetIds);
  const forceExclude = [...recommended].filter((id) => !selected.has(id)).sort();
  const forceInclude = [...selected].filter((id) => !recommended.has(id)).sort();
  if (forceInclude.length === 0 && forceExclude.length === 0) return undefined;
  return { forceInclude, forceExclude };
}

export function formatSummary(spec: InstallSpec): string {
  const opts = (Object.keys(spec.options) as Array<keyof OptionFlags>)
    .filter((k) => spec.options[k])
    .map((k) => k.replace(/^with/, "").toLowerCase());
  // v26.63.3 (clarify H1): "(defaults only)" 모호 → "(none added)" 명료.
  const optsLabel = opts.length > 0 ? opts.join(", ") : "(none added)";
  const lines = [
    `Tracks:    ${spec.tracks.join(", ")}`,
    `Options:   ${optsLabel}`,
    `CLI:       ${spec.cli.join(" · ")}`,
    `Target:    ${spec.projectDir}`,
  ];

  // v26.62.3 — 실제 install 될 자산 list 명시. defaults 만으로는 사용자가
  //   Step 3 에서 무엇을 confirm 했는지 알 수 없음. preset recommended +
  //   userOverride 적용 후 최종 selected assets list 표시.
  // v26.82.0 (Phase R, S6) — merge/그룹화는 preset-recommend.ts 단일 구현 사용 (중복 제거).
  const finalAssets = finalSelectedAssets(spec.tracks, spec.userOverride);
  if (finalAssets.length > 0) {
    // v26.102.0 (ADR-031) — confirm 화면의 약속 숫자에 CLI 도달 분해 병기 (SOD 리뷰 F3:
    // "4 selected" 확정 후 0 설치이던 불일치 — 숨김 없이 고지만).
    const unreachable = finalAssets.filter((id) => {
      const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
      return asset ? !assetReachesCli(asset, spec.cli) : false;
    });
    lines.push(
      unreachable.length > 0
        ? `Assets:    ${finalAssets.length} selected (${unreachable.length} outside [${spec.cli.join(", ")}] reach — not installed)`
        : `Assets:    ${finalAssets.length} selected`,
    );
    for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
      lines.push(`  · ${cat}: ${ids.join(", ")}`);
    }
    // v26.103.0 (ADR-032) — header 와 동일 문구 (표면별 상이 문구 금지, v26.88.0 교훈).
    const cost = formatResidentCostLine(
      residentCost(buildManifest(spec).filter((e) => e.applies(spec))),
      summarizeContextCost(finalAssets).unmeasuredCount,
    );
    if (cost) lines.push(`  · ${cost}`);
  }

  if (spec.userOverride) {
    if (spec.userOverride.forceInclude.length > 0) {
      lines.push(`  +User added: ${spec.userOverride.forceInclude.join(", ")}`);
    }
    if (spec.userOverride.forceExclude.length > 0) {
      lines.push(`  -User removed: ${spec.userOverride.forceExclude.join(", ")}`);
    }
  }
  return lines.join("\n");
}

// v26.54.0 — Re-exports to keep test imports stable (test의 mock 구조 변경 없음)
export { EXTERNAL_ASSETS, VISIBLE_OPTION_DEFS };
