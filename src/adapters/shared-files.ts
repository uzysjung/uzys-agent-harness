/**
 * 함께 쓰는 파일 표 (#551 · ADR-097 §6.2) — `index.ts` 가 다시 내보낸다. 어댑터 구현을 끌어오지 않는 따로 된 모듈인
 * 이유: 설치 기록(`install-log.ts`)이 키 id 접두를 이 표에서 유도해야 하는데(ADR-099 R5), 어댑터들은 기록 모듈의
 * `hashContent` 를 모듈 평가 때 부른다 — 표만 여기 두면 순환 import 가 생기지 않는다.
 */

import type { Adapter } from "../install-log.js";

export interface SharedFile {
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

/** 키 id 의 접두 전부(`mcp:` · `settings:` …) — 키 id 를 알아보는 곳은 이것으로만 판정한다(ADR-099 키 id 집합). */
export const KEY_ID_PREFIXES: ReadonlyArray<string> = Object.values(SHARED_FILES).map(
  (f) => f.prefix,
);

/** 함께 쓰는 파일의 키 id 인가(`mcp:github` · `settings:hooks.SessionStart#x.sh`). */
export function isKeyId(id: string): boolean {
  return KEY_ID_PREFIXES.some((p) => id.startsWith(p));
}
