// #543 `uninstall --track` — "T 전용" = claudeTargets(기록 트랙) − claudeTargets(남는 트랙), install 과 같은 게이팅(기본 옵션).
// `recordedTrackTargets` 는 번들 스킬을 전부 대상으로 봐서 쓰면 옵트인 스킬까지 나간다.

import { trackDefaultMcpAssetIds } from "./cli-transforms.js";
import { EXTERNAL_ASSETS, type ExternalAsset, shouldInstallAsset } from "./external-assets.js";
import { type InstallLog, installedClis } from "./install-log.js";
import { bundlePath } from "./recorded.js";
import { claudeTargets } from "./track-heal.js";
import { DEFAULT_OPTIONS, isTrack, type Track } from "./types.js";

export interface TrackRemoval {
  target: Track;
  /** 기록 트랙 중 지금 어휘에 있는 것 — 마지막 트랙 판정도 이것으로 센다. */
  known: Track[];
  remaining: Track[];
  /** 엔진의 회수 범위 — 그 트랙만 가져오는 claude 자리(파일 · 스킬 디렉터리)와 `.agents/` 의 같은 번들 이름. */
  has: (path: string) => boolean;
}

export function trackRemoval(log: InstallLog, target: Track): TrackRemoval {
  const known = log.spec.tracks.filter(isTrack);
  const remaining = known.filter((t) => t !== target);
  const stays = claudeTargets(remaining);
  const only = [...claudeTargets(known)].filter((p) => !stays.has(p));
  const has = (path: string): boolean =>
    only.some((t) => claudeSpot(path) === t || claudeSpot(path).startsWith(`${t}/`));
  return { target, known, remaining, has };
}

/** `.agents/` 자리를 같은 번들 이름으로 — 스킬은 `bundlePath`, Antigravity 룰은 `.claude/rules/` 의 같은 이름. */
function claudeSpot(path: string): string {
  return bundlePath(path).replace(/^\.agents\/rules\//, ".claude/rules/");
}

/** `removes: rules ui-components · skills ui-visual-review` — **엔진 미리보기가 지울 경로**에서 만든다(리뷰 BLOCKER-1). */
export function trackRemovalNames(removed: ReadonlyArray<string>, target: Track): string {
  const groups = new Map<string, Set<string>>();
  for (const p of removed) {
    const m = /^\.claude\/([^/]+)\/([^/]+?)(?:\.md)?(?:\/|$)/.exec(claudeSpot(p));
    const [kind, name] = m ? [m[1] ?? "", m[2] ?? ""] : ["files", p];
    groups.set(kind, (groups.get(kind) ?? new Set()).add(name));
  }
  const names = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kind, names]) => `${kind} ${[...names].sort().join(", ")}`);
  return `removes: ${names.join(" · ") || `nothing only ${target} installs`}`;
}

/** 남기는 것(설계 D1 · D2) — 기록에 있는 그 트랙의 기본 외부 자산 · 기본 MCP 행과 빼는 명령. 화면 접두는 부르는 쪽이 붙인다. */
export function trackLeftLines(log: InstallLog, r: TrackRemoval, harnessRoot: string): string[] {
  const recorded = new Set(log.assets.map((a) => a.id));
  const def = (a: ExternalAsset, tracks: Track[]) =>
    shouldInstallAsset(a, { tracks, options: DEFAULT_OPTIONS });
  const mine = (a: ExternalAsset) => def(a, r.known) && !def(a, r.remaining);
  const lines = EXTERNAL_ASSETS.filter(
    (a) => a.method.kind !== "internal" && recorded.has(a.id) && mine(a),
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
  // 기록된 CLI 를 모두 붙인다 — 빠지면 install 이 claude 하나로 렌더해 Codex · OpenCode 에는 서버가 남는다(리뷰 HIGH-1)
  const flags = [
    r.remaining.map((t) => `--track ${t}`),
    installedClis(log).map((c) => `--cli ${c}`),
  ];
  const command = `agent-harness install ${[...flags.flat(), ...mcp.map((id) => `--without ${id}`)].join(" ")}`;
  return [
    ...lines,
    `MCP servers ${mcp.join(" · ")} (defaults of ${r.target}, kept because your install record has them) — drop: ${command} (this re-runs the whole install: harness files refreshed, edited ones backed up; --without stays on record, so add --with <id> to get one back later)`,
  ];
}
