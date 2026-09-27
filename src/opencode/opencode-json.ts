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

interface OpencodeConfig {
  $schema?: string;
  instructions?: string[];
  mcp?: Record<string, OpencodeLocalMcp>;
  command?: Record<string, unknown>;
  agent?: Record<string, unknown>;
  plugin?: string[];
  permission?: Record<string, unknown>;
  [key: string]: unknown;
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
      Object.entries(params.mcp.mcpServers).map(([name, cfg]) => {
        const local: OpencodeLocalMcp = { type: "local", command: [cfg.command, ...cfg.args] };
        if (cfg.env && Object.keys(cfg.env).length > 0) local.environment = { ...cfg.env };
        return [name, local];
      }),
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
