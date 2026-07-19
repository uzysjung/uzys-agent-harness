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
      // v26.126.0 (R-3a) — skills 가 목록에 들어왔다. 이 문구가 곧 update 의 광고이고
      // (update 는 위저드로만 도달한다) 실동작과 어긋나면 그 자체로 거짓출하다.
      hint: "Refresh rules / agents / commands / hooks / skills — your edits are backed up",
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
