/**
 * opencode.json transform — fill template + `mcp.<name>` from the harness MCP servers.
 *
 * Output: opencode.json (top-level `mcp.<name>` map).
 *
 * #568 — 서버마다 **OpenCode 형식**으로 옮긴다: `{ type: "local", command: [cmd, ...args],
 * environment? }`. Claude `.mcp.json` 형식(`{ type: "stdio", command, args }`)을 그대로 넣으면
 * OpenCode 가 설정 파일 전체를 거절한다 — 실측(opencode 1.18.32, 컨테이너 2026-09-27):
 * `Configuration is invalid … Expected { "type": "local" } | { "type": "remote" }` 로 exit 1,
 * 같은 서버를 이 형식으로 쓰면 `opencode mcp list` 에 connected. 스키마 = https://opencode.ai/config.json
 * `McpLocalConfig`(additionalProperties false).
 */

import type { McpJson } from "../mcp-merge.js";

export interface RenderOpencodeJsonParams {
  /** Template content (templates/opencode/opencode.json.template). */
  template: string;
  /** 하네스 MCP 서버 (Claude `.mcp.json` 형식). 주면 top-level `mcp` 를 OpenCode 형식으로 바꿔 채운다. */
  mcp?: McpJson | null;
}

/** OpenCode `McpLocalConfig` — 우리가 쓰는 필드만. */
interface OpencodeLocalMcp {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
}

/**
 * OpenCode `McpRemoteConfig` — 우리가 쓰는 필드만(#711 · ADR-106). 헤더 인증 서버는 `oauth: false` — 401 을 보고 OAuth 를
 * 시작하지 않게 한다(공식: "Disable automatic OAuth … for servers that authenticate via static API keys or custom headers").
 */
interface OpencodeRemoteMcp {
  type: "remote";
  url: string;
  oauth?: false;
  headers?: Record<string, string>;
}

type OpencodeMcp = OpencodeLocalMcp | OpencodeRemoteMcp;

interface OpencodeConfig {
  $schema?: string;
  instructions?: string[];
  mcp?: Record<string, OpencodeMcp>;
  command?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  plugin?: string[];
  permission?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * 하네스 서버 하나 → OpenCode 형식. stdio → `McpLocalConfig`, 원격 → `McpRemoteConfig`. 토큰은 `{env:NAME}` 치환으로만 —
 * 값은 파일에 쓰지 않는다(OpenCode 가 실행 때 읽는다, 미설정이면 빈 문자열).
 */
function toOpencode(cfg: McpJson["mcpServers"][string]): OpencodeMcp {
  if (cfg.type === "http") {
    return cfg.auth === undefined
      ? { type: "remote", url: cfg.url }
      : {
          type: "remote",
          url: cfg.url,
          oauth: false,
          headers: { Authorization: `Bearer {env:${cfg.auth.bearerEnv}}` },
        };
  }
  const local: OpencodeLocalMcp = { type: "local", command: [cfg.command, ...cfg.args] };
  if (cfg.env && Object.keys(cfg.env).length > 0) local.environment = { ...cfg.env };
  return local;
}

/**
 * #563 (ADR-097 §6.2 `json-keys`) — `opencode.json` 의 하네스 몫 = 서버마다 키 `mcp.<name>`. 설치자 파일에는 이것만
 * 더한다 — 템플릿의 나머지 키(`$schema` · `agent` · `permission` …)는 하네스가 파일을 **새로 만들 때만** 바탕(seed)으로
 * 깔리고, 그 순간부터 설치자 것이다.
 */
export function renderOpencodeMcp(mcp: McpJson): Map<string, OpencodeMcp> {
  return new Map(
    Object.entries(mcp.mcpServers).map(([name, cfg]) => [`mcp.${name}`, toOpencode(cfg)]),
  );
}

/**
 * Substitute `mcp` in the template with the harness MCP servers (OpenCode format).
 * Other keys (`agent`, `command`, `plugin`, `permission`, `instructions`,
 * `$schema`) are preserved from the template.
 */
export function renderOpencodeJson(params: RenderOpencodeJsonParams): string {
  const config = parseTemplate(params.template);

  if (params.mcp) {
    config.mcp = Object.fromEntries(
      Object.entries(params.mcp.mcpServers).map(([name, cfg]) => [name, toOpencode(cfg)]),
    );
  }

  return `${JSON.stringify(config, null, 2)}\n`;
}

function parseTemplate(template: string): OpencodeConfig {
  try {
    return JSON.parse(template) as OpencodeConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`opencode.json template invalid JSON: ${message}`);
  }
}
