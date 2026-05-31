import type { DetectedInstall } from "./state.js";

export type RouterAction = "add" | "update" | "remove" | "reinstall" | "exit";

export interface RouterChoice {
  value: RouterAction;
  label: string;
  hint?: string;
  enabled: boolean;
}

/**
 * 5-action menu for an existing install. Mirrors prompt_action_router (setup-harness.sh:255).
 *
 * "remove" is exposed but disabled — no reliable file-ownership mapping yet (would risk data loss).
 */
export function buildRouterChoices(state: DetectedInstall): RouterChoice[] {
  const detected = state.tracks.length > 0 ? state.tracks.join(", ") : "(none detected)";
  return [
    {
      value: "add",
      label: "Add a new Track",
      hint: `Current: ${detected}`,
      enabled: true,
    },
    {
      value: "update",
      label: "Update policy files (auto-backup)",
      hint: "Refresh rules / agents / commands / hooks from latest templates",
      enabled: true,
    },
    {
      value: "remove",
      label: "Remove a Track (unsupported)",
      hint: "Manual edit of .claude/ required — not automated",
      enabled: false,
    },
    {
      value: "reinstall",
      label: "Reinstall (backs up current .claude/ first)",
      hint: "Use when state is corrupted",
      enabled: true,
    },
    {
      value: "exit",
      label: "Exit",
      enabled: true,
    },
  ];
}

export function summarizeState(state: DetectedInstall): string {
  if (state.state === "new") {
    return "No prior install detected — new install flow.";
  }
  const trackList = state.tracks.length > 0 ? state.tracks.join(", ") : "(no tracks resolved)";
  const sourceLabel =
    state.source === "metafile"
      ? "via .claude/.installed-tracks"
      : state.source === "legacy"
        ? "via legacy rules/*.md heuristic"
        : "via no source";
  return `Existing install detected ${sourceLabel}. Tracks: ${trackList}.`;
}
