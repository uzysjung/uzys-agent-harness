import type { InstallMode } from "./installer.js";
import { defaultPrompts, type Prompts } from "./prompts.js";
import { type DetectedInstall, detectInstallState } from "./state.js";
import type { InstallSpec, OptionFlags, Track } from "./types.js";

/** Convert an array of selected option keys into a fully-populated OptionFlags. */
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
    withCodexPrompts: picked.has("withCodexPrompts"),
    withAddyAgentSkills: picked.has("withAddyAgentSkills"),
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

  const tracks = await prompts.selectTracks(initialTracks);
  if (tracks === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }

  const optionKeys = await prompts.selectOptionKeys();
  if (optionKeys === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  const options = applyOptionRules(toOptionFlags(optionKeys));

  const cli = await prompts.selectCli(["claude"]);
  if (cli === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }

  const summary = formatSummary({ tracks, options, cli, projectDir });
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
    spec: { tracks, options, cli, projectDir },
  };
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
