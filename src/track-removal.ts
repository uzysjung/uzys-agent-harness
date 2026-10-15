/**
 * #543 — `uninstall --track <t>` 가 빼는 것과 남기는 것. 엔진(회수 범위)과 화면 둘(dry-run · 위저드 확인)이 이 모듈을 같이 읽는다.
 * "T 전용" = `claudeTargets(기록 트랙) − claudeTargets(남는 트랙)` — install 과 같은 트랙 게이팅(기본 옵션). `recordedTrackTargets` 는
 * 번들 스킬을 전부 대상으로 봐서(옵션 선택이 기록에 없다) 쓰면 옵트인 스킬까지 나간다.
 */

import { trackDefaultMcpAssetIds } from "./cli-transforms.js";
import { EXTERNAL_ASSETS, shouldInstallAsset } from "./external-assets.js";
import type { InstallLog } from "./install-log.js";
import { claudeTargets } from "./track-heal.js";
import { DEFAULT_OPTIONS, isTrack, type Track } from "./types.js";

export interface TrackRemoval {
  target: Track;
  /** 기록 트랙 중 지금 어휘에 있는 것 — 마지막 트랙 판정도 이것으로 센다. */
  known: Track[];
  remaining: Track[];
  /** 그 트랙만 가져오는 claude 자리 대상(파일 · 스킬 디렉터리), 정렬. */
  only: string[];
}

export function trackRemoval(log: InstallLog, target: Track): TrackRemoval {
  const known = log.spec.tracks.filter(isTrack);
  const remaining = known.filter((t) => t !== target);
  const stays = claudeTargets(remaining);
  return {
    target,
    known,
    remaining,
    only: [...claudeTargets(known)].filter((p) => !stays.has(p)).sort(),
  };
}

/** `removes: rules ui-components · skills ui-visual-review` — dry-run 과 위저드 확인이 이 줄 하나를 같이 쓴다. */
export function trackRemovalNames(r: TrackRemoval): string {
  const groups = new Map<string, string[]>();
  for (const p of r.only) {
    const m = /^\.claude\/([^/]+)\/([^/]+?)(?:\.md)?$/.exec(p);
    const [kind, name] = m ? [m[1] ?? "", m[2] ?? ""] : ["files", p];
    groups.set(kind, [...(groups.get(kind) ?? []), name]);
  }
  const names = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, names]) => `${kind} ${names.join(", ")}`);
  return `removes: ${names.join(" · ") || `nothing only ${r.target} installs`}`;
}

/** 남기는 것(설계 D1 · D2) — 기록에 있는 그 트랙의 기본 외부 자산 · 기본 MCP 행과 빼는 명령. 화면 접두는 부르는 쪽이 붙인다. */
export function trackLeftLines(log: InstallLog, r: TrackRemoval, harnessRoot: string): string[] {
  const recorded = new Set(log.assets.map((a) => a.id));
  const was = { tracks: r.known, options: DEFAULT_OPTIONS };
  const stays = { tracks: r.remaining, options: DEFAULT_OPTIONS };
  const lines = EXTERNAL_ASSETS.filter(
    (a) =>
      a.method.kind !== "internal" &&
      recorded.has(a.id) &&
      shouldInstallAsset(a, was) &&
      !shouldInstallAsset(a, stays),
  ).map(
    (a) =>
      `asset ${a.id} (a default of ${r.target}) — remove with: agent-harness uninstall --only ${a.id}`,
  );
  const keys = (log.portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key);
  const staysMcp = new Set(trackDefaultMcpAssetIds(harnessRoot, r.remaining));
  const mcp = trackDefaultMcpAssetIds(harnessRoot, r.known).filter(
    (id) => !staysMcp.has(id) && keys.includes(`mcpServers.${id}`),
  );
  if (mcp.length === 0) return lines;
  const command = `agent-harness install ${r.remaining.map((t) => `--track ${t}`).join(" ")} ${mcp.map((id) => `--without ${id}`).join(" ")}`;
  return [
    ...lines,
    `MCP servers ${mcp.join(" · ")} (defaults of ${r.target}, kept because your install record has them) — drop: ${command} (this re-runs the whole install: harness files refreshed, edited ones backed up; --without stays on record, so add --with <id> to get one back later)`,
  ];
}
