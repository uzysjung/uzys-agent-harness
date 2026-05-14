import { existsSync, readFileSync, writeFileSync } from "node:fs";
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
 * Compose the final `.mcp.json` for a project install.
 * Read base template + track map, merge with optional existing user file (additive).
 */
export function composeMcpJson(opts: {
  templateMcpPath: string;
  trackMapPath: string;
  existingPath?: string;
  tracks: ReadonlyArray<Track>;
}): McpJson {
  const base = JSON.parse(readFileSync(opts.templateMcpPath, "utf8")) as McpJson;
  const merged =
    opts.existingPath && existsSync(opts.existingPath)
      ? mergeUserBase(base, opts.existingPath)
      : base;
  const mapRaw = existsSync(opts.trackMapPath) ? readFileSync(opts.trackMapPath, "utf8") : "";
  const rows = parseTrackMcpMap(mapRaw);
  return mergeMcpServers(merged, rows, opts.tracks);
}

function mergeUserBase(base: McpJson, existingPath: string): McpJson {
  try {
    const existing = JSON.parse(readFileSync(existingPath, "utf8")) as McpJson;
    return {
      ...base,
      mcpServers: { ...base.mcpServers, ...existing.mcpServers },
    };
  } catch {
    return base;
  }
}

/** Write the composed `.mcp.json` to disk (2-space pretty). */
export function writeMcpJson(path: string, mcp: McpJson): void {
  writeFileSync(path, `${JSON.stringify(mcp, null, 2)}\n`);
}
