import { existsSync, readFileSync } from "node:fs";
import { keyId } from "./adapters/index.js";
import { EXTERNAL_ASSETS, isAssetSelected } from "./external-assets.js";
import type { InstallLog } from "./install-log.js";
import { anyTrack } from "./track-match.js";
import type { Track } from "./types.js";

export interface McpServerConfig {
  type?: "stdio" | "http";
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpJson {
  mcpServers: Record<string, McpServerConfig>;
  _comment?: string;
}

export interface TrackMcpRow {
  name: string;
  pattern: string;
  command: string;
  args: string[];
}

/** Parse `templates/track-mcp-map.tsv` (tab-separated, comment-aware). */
export function parseTrackMcpMap(raw: string): TrackMcpRow[] {
  const rows: TrackMcpRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = line.split("\t");
    if (parts.length < 4) {
      continue;
    }
    const [name, pattern, command, argsJson] = parts;
    if (!name || !pattern || !command) {
      continue;
    }
    let args: unknown;
    try {
      args = JSON.parse(argsJson ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      continue;
    }
    rows.push({ name, pattern, command, args: args as string[] });
  }
  return rows;
}

/**
 * Apply track-aware MCP rows to a base `.mcp.json` object.
 * Existing entries (including user customizations) are preserved.
 */
export function mergeMcpServers(
  base: McpJson,
  rows: ReadonlyArray<TrackMcpRow>,
  tracks: ReadonlyArray<Track>,
  /** #709 — 트랙 패턴 밖이어도 넣을 행 이름(`selectedMcpServers`). 기본 행과 겹치면 한 항목이다. */
  chosen: ReadonlyArray<string> = [],
): McpJson {
  const out: McpJson = {
    ...base,
    mcpServers: { ...base.mcpServers },
  };
  for (const row of rows) {
    if (!anyTrack(tracks, row.pattern) && !chosen.includes(row.name)) {
      continue;
    }
    if (out.mcpServers[row.name]) {
      // Preserve existing — do not overwrite user customizations.
      continue;
    }
    out.mcpServers[row.name] = {
      type: "stdio",
      command: row.command,
      args: row.args,
    };
  }
  // Strip _comment marker (parity with the bash `jq 'del(._comment)'`).
  delete out._comment;
  return out;
}

/**
 * 하네스가 이 트랙에 까는 `.mcp.json` 서버 — 템플릿 + 트랙 표. **설치자 파일과 합치지 않는다**:
 * 설치자 파일에 하네스 몫을 더하는 일은 `json-keys` 어댑터가 한다(#551 PR-3). 여기서 합치던 판은
 * 설치자 파일을 못 읽으면 템플릿으로 덮었다(#574) — 합치는 자리를 하나로 줄여 그 경로가 없다.
 */
export function composeMcpJson(opts: {
  templateMcpPath: string;
  trackMapPath: string;
  tracks: ReadonlyArray<Track>;
  /** #709 — 트랙 패턴 밖에서 넣을 행 이름을 표에서 고른다(`selectedMcpServers` · uninstall 은 고를 수 있는 행 전부). */
  chosen: (rows: ReadonlyArray<TrackMcpRow>) => ReadonlyArray<string>;
}): McpJson {
  const base = JSON.parse(readFileSync(opts.templateMcpPath, "utf8")) as McpJson;
  const mapRaw = existsSync(opts.trackMapPath) ? readFileSync(opts.trackMapPath, "utf8") : "";
  const rows = parseTrackMcpMap(mapRaw);
  return mergeMcpServers(base, rows, opts.tracks, opts.chosen(rows));
}

/**
 * #709 (ADR-101) — 어느 트랙에서든 **고를 수 있는** 트랙 표 행(서버 이름 → 자산 id): 카탈로그 `internal` 자산의 `key` 가
 * 행 이름인 것. 대응은 이 한 규칙뿐이다 — 따로 표를 두지 않는다. 행의 패턴은 기본 트랙을 정하고, 이 자산은 그 밖의
 * 트랙에서 위저드 체크 · `--with <id>` 로 고르게 한다. 서버 정의(명령 · 인자)는 여전히 트랙 표 한 곳에 있다.
 */
export function selectableMcpServers(rows: ReadonlyArray<TrackMcpRow>): Map<string, string> {
  const names = new Set(rows.map((r) => r.name));
  const out = new Map<string, string>();
  for (const a of EXTERNAL_ASSETS) {
    if (a.method.kind === "internal" && names.has(a.method.key)) out.set(a.method.key, a.id);
  }
  return out;
}

/** 이 실행에서 무엇을 골랐나 — `selectedMcpServers` 의 입력. */
export interface McpChoice {
  /** 이번 선택 — `isAssetSelected` 와 같은 입력(트랙 · `--with`/위저드 체크). */
  spec: Parameters<typeof isAssetSelected>[1];
  /** 이 실행 뒤의 누적 빼기(install = `thisRunExclusions`, update = 기록의 `excludedIds`). */
  excluded: ReadonlySet<string>;
  previousLog: InstallLog | null;
}

/**
 * #709 — 트랙 패턴 밖에서 이번 렌더에 넣을 선택 행 이름. 둘 다 만족해야 한다:
 *
 * ⓐ 설치자가 빼지 않았다 — 자산 id(`railway-mcp-server`)로도 키 id(`mcp:railway-mcp-server`, ADR-099 R4)로도.
 * ⓑ 이번 실행이 골랐거나(위저드 체크 · `--with`), **기록**이 그 서버를 하네스 몫으로 적었다(`.mcp.json` 몫). 디스크
 *    존재는 근거가 아니다(ADR-096) — 기록 조항이 없으면 렌더에 없는 기록 키를 `planUpsert` 가 지운다(조용한 삭제).
 */
export function selectedMcpServers(rows: ReadonlyArray<TrackMcpRow>, choice: McpChoice): string[] {
  const recorded = new Set(
    (choice.previousLog?.portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key),
  );
  const out: string[] = [];
  for (const [name, assetId] of selectableMcpServers(rows)) {
    const key = `mcpServers.${name}`;
    const id = keyId(".mcp.json", key);
    if (choice.excluded.has(assetId) || (id !== null && choice.excluded.has(id))) continue;
    if (isAssetSelected(assetId, choice.spec) || recorded.has(key)) out.push(name);
  }
  return out;
}

/**
 * #709 — 기록이 하네스 몫으로 적은 `.mcp.json` 서버 중 카탈로그 `internal` 자산이 가리키는 것의 자산 id. 위저드 update
 * 흐름이 이 서버를 **체크된 채** 보이고(체크 = 확인 뒤 디스크에 있다), 해제하면 `--without <id>` 로 낸다. 기록된 몫은
 * 렌더한 키뿐이라 같은 이름의 `internal` 자산이면 곧 트랙 표의 고를 수 있는 행이다 — 트랙 표를 다시 읽지 않는다.
 */
export function recordedMcpAssetIds(log: InstallLog | null): string[] {
  const recorded = new Set(
    (log?.portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key),
  );
  return EXTERNAL_ASSETS.filter(
    (a) => a.method.kind === "internal" && recorded.has(`mcpServers.${a.method.key}`),
  ).map((a) => a.id);
}
