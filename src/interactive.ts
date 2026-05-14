import type { InstallMode } from "./installer.js";
import { recommendedExternalAssets } from "./preset-recommend.js";
import { defaultPrompts, type Prompts } from "./prompts.js";
import { type DetectedInstall, detectInstallState } from "./state.js";
import type { InstallSpec, OptionFlags, Track } from "./types.js";

/**
 * Convert an array of selected option keys into a fully-populated OptionFlags.
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
    withCodexPrompts: false, // v26.46.0 — cli=codex 결정 후 자동 설정 (interactive 직접 토글 X)
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
  /** Install mode dispatched (router action). Default "fresh" for new installs. */
  mode?: InstallMode;
  /** When ok=false: machine-readable reason (`no-tty`, `cancelled`, `disabled-action`, `exit`). */
  reason?: "no-tty" | "cancelled" | "disabled-action" | "exit";
  message?: string;
}

/**
 * Orchestrates the interactive flow.
 *
 * Phase B scope:
 *   - State detection (new vs existing)
 *   - 5-action router for existing installs
 *   - Track / options / CLI prompts for new + add + reinstall paths
 *   - Confirmation summary
 *
 * The actual install pipeline (Phase C) consumes the returned `InstallSpec`.
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
      // Update mode은 정책 파일만 갱신 — Track 변경 없음. spec.tracks = state.tracks.
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
      // reinstall: clean slate prompt (no initialTracks)
    }
  }

  // v26.46.0 — Wizard back navigation. v26.47.0 — assets step 추가 (Phase C full).
  // ESC at each step = back to previous; ESC at tracks = exit; ESC at confirm = exit.
  type Step = "tracks" | "options" | "cli" | "assets" | "confirm";
  let step: Step = "tracks";
  let tracks: Track[] | null = null;
  let optionKeys: Array<keyof OptionFlags> | null = null;
  let cli: import("./types.js").CliTargets | null = null;
  let assetSelections: ReadonlyArray<string> | null = null;

  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(tracks ?? initialTracks);
      if (result === null) {
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      tracks = result;
      step = "options";
    } else if (step === "options") {
      const result = await prompts.selectOptionKeys(optionKeys ?? undefined);
      if (result === null) {
        step = "tracks";
        continue;
      }
      optionKeys = result;
      step = "cli";
    } else if (step === "cli") {
      const result = await prompts.selectCli(cli ?? ["claude"]);
      if (result === null) {
        step = "options";
        continue;
      }
      cli = result;
      step = "assets";
    } else if (step === "assets") {
      // v26.47.0 (Phase C full) — External Asset Step 2. preset 추천 + 옵션-키 활성 자산이 추천 ✓.
      const recommended = recommendedExternalAssets(tracks ?? []);
      const initial = assetSelections ?? recommended;
      const result = await prompts.selectExternalAssets(initial);
      if (result === null) {
        step = "cli";
        continue;
      }
      assetSelections = result;
      step = "confirm";
    } else {
      // confirm — tracks/optionKeys/cli 모두 이전 step 에서 set (narrowing).
      // biome-ignore lint/style/noNonNullAssertion: confirm step 도달 = 모든 이전 step 완료 보장
      const finalTracks = tracks!;
      // biome-ignore lint/style/noNonNullAssertion: same as above
      const finalCli = cli!;
      const options = applyOptionRules(toOptionFlags(optionKeys ?? []));
      // v26.46.0 — cli=codex 시 Codex prompts default ON (ADR-012).
      if (finalCli.includes("codex")) {
        options.withCodexPrompts = true;
      }
      // v26.47.0 — Phase C full: assets step 결과 → userOverride diff 계산.
      const userOverride = computeUserOverride(finalTracks, assetSelections);
      const summary = formatSummary({
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        ...(userOverride ? { userOverride } : {}),
      });
      const confirmed = await prompts.confirmInstall(summary);
      if (confirmed === null) {
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
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
 * v26.47.0 — Phase C full. Step 2 결과 (assetSelections) 와 preset 추천 비교 → forceInclude/forceExclude.
 * - `recommended - selected` → forceExclude (사용자가 추천에서 unchecked)
 * - `selected - recommended` → forceInclude (사용자가 추가 선택)
 * - 둘 다 비어 있으면 undefined (backward compat — userOverride 없음).
 */
export function computeUserOverride(
  tracks: ReadonlyArray<Track>,
  assetSelections: ReadonlyArray<string> | null,
): { forceInclude: ReadonlyArray<string>; forceExclude: ReadonlyArray<string> } | undefined {
  if (assetSelections === null) return undefined;
  const recommended = new Set(recommendedExternalAssets(tracks));
  const selected = new Set(assetSelections);
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
  return [
    `Tracks:    ${spec.tracks.join(", ")}`,
    `Options:   ${optsLabel}`,
    `CLI:       ${spec.cli.join(" · ")}`,
    `Target:    ${spec.projectDir}`,
  ].join("\n");
}
