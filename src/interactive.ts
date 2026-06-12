import { EXTERNAL_ASSETS } from "./external-assets.js";
import type { InstallMode } from "./installer.js";
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
import { stepLabel, WIZARD } from "./wizard-steps.js";

/**
 * v26.54.0 — All-in-one 결과 → option keys + asset id list 분리.
 * `option:<key>` → OptionFlags key
 * `asset:<id>` → EXTERNAL_ASSETS id
 */
export function splitInstallTargets(targets: ReadonlyArray<InstallTargetId>): {
  optionKeys: Array<keyof OptionFlags>;
  assetIds: Array<string>;
} {
  const optionKeys: Array<keyof OptionFlags> = [];
  const assetIds: Array<string> = [];
  for (const t of targets) {
    if (t.startsWith("option:")) {
      optionKeys.push(t.slice("option:".length) as keyof OptionFlags);
    } else if (t.startsWith("asset:")) {
      assetIds.push(t.slice("asset:".length));
    }
  }
  return { optionKeys, assetIds };
}

/**
 * v26.46.0 — `withCodexPrompts` 는 interactive 옵션 list 에서 제거됨 (CLI 전용 opt-in).
 * v26.81.0 (ADR-022) — 자산 1:1 boolean 13종 삭제 후 잔존 동작 옵션만 매핑.
 *   wizard 의 자산 선택은 전부 `asset:<id>` → userOverride.forceInclude 경로.
 */
export function toOptionFlags(keys: ReadonlyArray<keyof OptionFlags>): OptionFlags {
  const picked = new Set<keyof OptionFlags>(keys);
  return {
    withPrune: picked.has("withPrune"),
    withCodexSkills: picked.has("withCodexSkills"),
    withCodexTrust: picked.has("withCodexTrust"),
    withKarpathyHook: picked.has("withKarpathyHook"),
    withCodexPrompts: false,
    withAntigravityGlobal: picked.has("withAntigravityGlobal"),
  };
}

export interface InteractiveDeps {
  prompts?: Prompts;
  detect?: (projectDir: string) => DetectedInstall;
  isTty?: () => boolean;
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
        "Interactive mode requires a TTY. Use `claude-harness install --track <name>` for non-interactive use.",
    };
  }

  prompts.intro("uzys-claude-harness installer");
  const state = detect(projectDir);

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
      const summary = formatSummary({
        tracks: state.tracks,
        options: toOptionFlags([]),
        cli: ["claude"],
        projectDir,
      });
      const confirmed = await prompts.confirmInstall(`UPDATE policy files only:\n${summary}`);
      if (!confirmed) {
        prompts.outro("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro("Running update mode...");
      return {
        ok: true,
        mode: "update",
        spec: {
          tracks: state.tracks,
          options: toOptionFlags([]),
          cli: ["claude"],
          projectDir,
        },
      };
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
          : recommendedExternalAssets(tracks ?? []).map((id) => `asset:${id}` as InstallTargetId);
      // v26.65.0 — step indicator SSOT (wizard-steps.ts). Phase: 3 targets → 4 scope → 5 confirm → 6 install.
      const result = await prompts.selectInstallTargets(initial, WIZARD.TARGETS, {
        tracks: tracks ?? [],
        cli: cli ?? ["claude"],
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
      const { optionKeys, assetIds } = splitInstallTargets(targetSelections ?? []);
      const options = toOptionFlags(optionKeys);
      // v26.64.0 (ADR-020, BREAKING) — ADR-012/017 supersede. cli=codex 자동 default ON 폐기.
      // withCodexPrompts 는 사용자 명시 install target (목록 체크) 시에만 활성. 자동 ON 안 함.
      // scope=global 일 때만 ~/.codex/prompts/ 에 실 write (installer.ts).
      const userOverride =
        targetSelections === null ? undefined : computeUserOverride(finalTracks, assetIds);
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
    lines.push(`Assets:    ${finalAssets.length} selected`);
    for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
      lines.push(`  · ${cat}: ${ids.join(", ")}`);
    }
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
