/**
 * 함께 쓰는 파일 → 어댑터 표 (#551 · ADR-097 §6.2). **이 표에 있는 경로가 `shared` 다** — 파일 종류는
 * 저장하지 않고 여기서 유도한다(설계 §1.2). 새 함께 쓰는 파일은 여기 한 줄, 새 형식이면 어댑터 하나.
 *
 * 키 id(`excluded` 에 적히는 이름)도 여기서 나온다. 설계가 이름을 정한 것은 넷(`mcp:` · `settings:` ·
 * `opencode:` · `gitignore:`)이고, 나머지 셋(`claude-md:` · `agents-md:` · `codex:`)은 같은 모양으로
 * 이 PR 이 붙인 이름이다 — `--with`/`--without` 이 받게 하는 것은 PR-5.
 */

import type { Adapter } from "../install-log.js";
import type { PortionAdapter } from "./contract.js";
import { isContainerKey, jsonKeys } from "./json-keys.js";
import { lines } from "./lines.js";
import { markerMd } from "./marker-md.js";
import { tomlRegion } from "./toml-region.js";

export type { PortionAdapter, StripResult, UpsertResult } from "./contract.js";

export const ADAPTERS: {
  "marker-md": PortionAdapter<string>;
  "json-keys": PortionAdapter<unknown>;
  "toml-region": PortionAdapter<string>;
  lines: PortionAdapter<string>;
} = {
  "marker-md": markerMd,
  "json-keys": jsonKeys,
  "toml-region": tomlRegion,
  lines,
};

interface SharedFile {
  adapter: Adapter;
  /** 키 id 접두(`mcp:`) */
  prefix: string;
  /** 어댑터 키 안에서 id 로 옮길 때 떼는 머리(`.mcp.json` 의 `mcpServers.`) */
  strip?: string;
}

export const SHARED_FILES: Readonly<Record<string, SharedFile>> = {
  "CLAUDE.md": { adapter: "marker-md", prefix: "claude-md:" },
  "AGENTS.md": { adapter: "marker-md", prefix: "agents-md:" },
  ".claude/settings.json": { adapter: "json-keys", prefix: "settings:" },
  ".mcp.json": { adapter: "json-keys", prefix: "mcp:", strip: "mcpServers." },
  "opencode.json": { adapter: "json-keys", prefix: "opencode:" },
  ".codex/config.toml": { adapter: "toml-region", prefix: "codex:" },
  ".gitignore": { adapter: "lines", prefix: "gitignore:" },
};

/** 이 경로가 함께 쓰는 파일이면 그 어댑터, 아니면 null. */
export function adapterFor(path: string): Adapter | null {
  return SHARED_FILES[path]?.adapter ?? null;
}

/**
 * 어댑터 키 → `excluded` 에 적는 키 id. 하네스가 만든 빈 컨테이너 키는 id 가 아니다(null).
 * 예: (`.mcp.json`, `mcpServers.github`) → `mcp:github` · (`.claude/settings.json`, `statusLine`) → `settings:statusLine`.
 */
export function keyId(path: string, key: string): string | null {
  const file = SHARED_FILES[path];
  if (file === undefined || isContainerKey(key)) return null;
  const body =
    file.strip !== undefined && key.startsWith(file.strip) ? key.slice(file.strip.length) : key;
  return `${file.prefix}${body}`;
}

/** `excluded` 목록에서 이 파일의 것만 어댑터 키로 — upsert/strip 의 `excluded` 입력. */
export function excludedKeys(path: string, excluded: Iterable<string>): Set<string> {
  const file = SHARED_FILES[path];
  const out = new Set<string>();
  if (file === undefined) return out;
  for (const id of excluded) {
    if (!id.startsWith(file.prefix)) continue;
    out.add(`${file.strip ?? ""}${id.slice(file.prefix.length)}`);
  }
  return out;
}
