import { EXTERNAL_ASSETS } from "./external-assets.js";
import type { InstallMode } from "./installer.js";
import { recommendedExternalAssets } from "./preset-recommend.js";
import {
  defaultPrompts,
  type InstallTargetId,
  type Prompts,
  VISIBLE_OPTION_DEFS,
} from "./prompts.js";
import { type DetectedInstall, detectInstallState } from "./state.js";
import type { InstallSpec, OptionFlags, Track } from "./types.js";

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
 * v26.46.0 — `withCodexPrompts` 는 interactive 옵션 list 에서 제거됨. cli=codex 선택 시
 * `runInteractive` 에서 자동 ON. 본 함수는 default false 로 시작.
 */
export function toOptionFlags(keys: ReadonlyArray<keyof OptionFlags>): OptionFlags {
  const picked = new Set<keyof OptionFlags>(keys);
  return {
    withTauri: picked.has("withTauri"),
    withGsd: picked.has("withGsd"),
    withEcc: picked.has("withEcc"),
    withPrune: picked.has("withPrune"),
    withTob: picked.has("withTob"),
    withCodexSkills: picked.has("withCodexSkills"),
    withCodexTrust: picked.has("withCodexTrust"),
    withKarpathyHook: picked.has("withKarpathyHook"),
    withCodexPrompts: false,
    withAddyAgentSkills: picked.has("withAddyAgentSkills"),
    withUzysHarness: picked.has("withUzysHarness"),
    withSuperpowers: picked.has("withSuperpowers"),
  };
}

/** Apply business rules to a flags object (e.g. --with-prune implies --with-ecc). */
export function applyOptionRules(flags: OptionFlags): OptionFlags {
  if (flags.withPrune && !flags.withEcc) {
    return { ...flags, withEcc: true };
  }
  return flags;
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
      prompts.cancel("Track removal is not automated in v27 — manually edit `.claude/`. Aborting.");
      return { ok: false, reason: "disabled-action" };
    }
    if (action === "update") {
      mode = "update";
      const summary = formatSummary({
        tracks: state.tracks,
        options: applyOptionRules(toOptionFlags([])),
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
          options: applyOptionRules(toOptionFlags([])),
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

  type Step = "tracks" | "cli" | "targets" | "confirm";
  let step: Step = "tracks";
  let tracks: Track[] | null = null;
  let cli: import("./types.js").CliTargets | null = null;
  let targetSelections: ReadonlyArray<InstallTargetId> | null = null;

  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(tracks ?? initialTracks);
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
      const result = await prompts.selectCli(cli ?? ["claude"]);
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
      const result = await prompts.selectInstallTargets(
        initial,
        { current: 3, total: 3 },
        {
          tracks: tracks ?? [],
          cli: cli ?? ["claude"],
        },
      );
      if (result === null) {
        step = "cli"; // silent back
        continue;
      }
      targetSelections = result;
      step = "confirm";
    } else {
      // confirm
      // biome-ignore lint/style/noNonNullAssertion: confirm step 도달 = 모든 이전 step 완료 보장
      const finalTracks = tracks!;
      // biome-ignore lint/style/noNonNullAssertion: same as above
      const finalCli = cli!;
      const { optionKeys, assetIds } = splitInstallTargets(targetSelections ?? []);
      const options = applyOptionRules(toOptionFlags(optionKeys));
      // v26.56.0 (ADR-017, BREAKING) — codexPrompts 자동 활성화 조건 변경.
      // 기존 (ADR-012): cli=codex → 자동 ON
      // 신규: cli=codex && withUzysHarness → 자동 ON
      // 이유: uzys-* 슬래시가 uzys-harness 의 일부. withUzysHarness=false 면 codex 글로벌 복사 의미 X.
      if (finalCli.includes("codex") && options.withUzysHarness) {
        options.withCodexPrompts = true;
      }
      const userOverride =
        targetSelections === null ? undefined : computeUserOverride(finalTracks, assetIds);
      const summary = formatSummary({
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        ...(userOverride ? { userOverride } : {}),
      });
      const confirmed = await prompts.confirmInstall(summary);
      if (confirmed === null) {
        step = "targets"; // silent back
        continue;
      }
      if (!confirmed) {
        prompts.outro("Cancelled by user.");
        return { ok: false, reason: "cancelled" };
      }
      prompts.outro("Running install pipeline...");
      return {
        ok: true,
        mode,
        spec: {
          tracks: finalTracks,
          options,
          cli: finalCli,
          projectDir,
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
  const optsLabel = opts.length > 0 ? opts.join(", ") : "(defaults only)";
  const lines = [
    `Tracks:    ${spec.tracks.join(", ")}`,
    `Options:   ${optsLabel}`,
    `CLI:       ${spec.cli.join(" · ")}`,
    `Target:    ${spec.projectDir}`,
  ];
  if (spec.userOverride) {
    if (spec.userOverride.forceInclude.length > 0) {
      lines.push(`  +Assets: ${spec.userOverride.forceInclude.join(", ")}`);
    }
    if (spec.userOverride.forceExclude.length > 0) {
      lines.push(`  -Assets: ${spec.userOverride.forceExclude.join(", ")}`);
    }
  }
  return lines.join("\n");
}

// v26.54.0 — Re-exports to keep test imports stable (test의 mock 구조 변경 없음)
export { EXTERNAL_ASSETS, VISIBLE_OPTION_DEFS };
