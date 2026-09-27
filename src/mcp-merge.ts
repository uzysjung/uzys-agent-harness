import { existsSync, readFileSync } from "node:fs";
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
): McpJson {
  const out: McpJson = {
    ...base,
    mcpServers: { ...base.mcpServers },
  };
  for (const row of rows) {
    if (!anyTrack(tracks, row.pattern)) {
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
}): McpJson {
  const base = JSON.parse(readFileSync(opts.templateMcpPath, "utf8")) as McpJson;
  const mapRaw = existsSync(opts.trackMapPath) ? readFileSync(opts.trackMapPath, "utf8") : "";
  const rows = parseTrackMcpMap(mapRaw);
  return mergeMcpServers(base, rows, opts.tracks);
}
