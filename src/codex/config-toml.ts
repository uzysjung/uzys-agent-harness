/**
 * config.toml transform — fill placeholders + append [mcp_servers.X] from the harness MCP servers.
 * Mirrors `claude-to-codex.sh` steps 2 + 5.
 *
 * #563 (ADR-097 §6.2) — 이 렌더는 **하네스 몫**이고 설치자 파일에는 `configRegions` 가 자른 두 구간으로만
 * 들어간다(`toml-region` 어댑터). 하네스가 새로 만드는 파일도 같은 두 구간뿐이다.
 */

import { readToml, TOP_REGION } from "../adapters/toml-region.js";
import { hashContent } from "../install-log.js";
import type { McpJson } from "../mcp-merge.js";

/** 표 구간 이름 — `toml-region` 은 `top` 만 파일 맨 앞에 두고 나머지 이름은 파일 끝에 둔다. */
export const TABLES_REGION = "tables";

/**
 * 렌더 결과를 하네스 몫 두 구간으로 자른다(ADR-097 §6.2): 첫 `[table]` 헤더 줄 앞 = `top`(최상위 키) · 그 뒤 =
 * `tables`. 줄로 자르는 것은 **우리 렌더**라서다 — 템플릿에 여러 줄 문자열이 없다. 설치자 파일은 이렇게 읽지 않는다
 * (그쪽 판정은 파서가 한다 — `toml-region`).
 */
export function configRegions(rendered: string): Map<string, string> {
  const lines = rendered.split(/\r?\n/);
  const at = lines.findIndex((l) => l.startsWith("["));
  const top = (at === -1 ? lines : lines.slice(0, at)).join("\n").trim();
  const tables = at === -1 ? "" : lines.slice(at).join("\n").trim();
  const out = new Map<string, string>();
  if (top !== "") out.set(TOP_REGION, top);
  if (tables !== "") out.set(TABLES_REGION, tables);
  return out;
}

/** 하네스 훅 스크립트 — 옛 판이 이 파일을 통째로 썼다는 내용 표지(설계 §5 의 "하네스 훅을 부르는 항목"). */
const HARNESS_HOOK = /(?:^|\/)\.codex\/hooks\/session-start\.sh$/;

function callsHarnessHook(parsed: Record<string, unknown>): boolean {
  const hooks = parsed.hooks;
  if (typeof hooks !== "object" || hooks === null) return false;
  const entries = (hooks as Record<string, unknown>).session_start;
  if (!Array.isArray(entries)) return false;
  return entries.some((entry) => {
    const command = (entry as { command?: unknown } | null)?.command;
    const parts = Array.isArray(command) ? command : [command];
    return parts.some((c) => typeof c === "string" && HARNESS_HOOK.test(c));
  });
}

/**
 * 마커 구간이 **없는** 읽히는 `config.toml` 이 옛 판(구간 모델 이전)이 통째로 쓴 파일인데 그 뒤 바뀌었나.
 *
 * 그렇다(= 하네스 훅을 부르는 항목이 있고 기준선 sha 와 다르거나 기록이 없다)면 어디까지가 설치자 것인지 가를 수
 * 없어 **쓰지 않는다** — 구간을 더하면 같은 훅이 두 번 돈다(`[[배열 표]]` 는 더하기라 충돌로 안 본다, `toml-region`).
 * 기준선 sha 그대로인 옛 파일은 여기 오지 않는다 — `writeShared` 가 새 형식으로 옮겨 쓴다. 훅을 부르지 않는 파일은
 * 설치자 파일이다(#563 첫 접촉 — 몫만 더한다).
 */
export function isChangedLegacyConfig(disk: string, baselineSha: string | undefined): boolean {
  if (baselineSha !== undefined && hashContent(disk) === baselineSha) return false;
  const parsed = readToml(disk);
  return parsed !== null && callsHarnessHook(parsed);
}

export interface RenderConfigTomlParams {
  template: string;
  projectName: string;
  projectDir: string;
  /** 하네스 MCP 서버 (`renderHarnessMcp`). When provided, one [mcp_servers.X] block per server is appended. */
  mcp?: McpJson | null;
}

/**
 * Substitute placeholders + append one `[mcp_servers.<name>]` per harness MCP server.
 *
 * 템플릿에는 살아 있는 `[mcp_servers.*]` 가 없다 — 서버의 원천은 하네스 MCP 하나다(#568). 예전에는 템플릿의 기본 블록을
 * 줄 단위로 걷어내고 바꿔 끼웠는데(`stripExistingMcpSection`), 원천이 하나가 된 뒤로는 걷어낼 것이 없다(#563).
 */
export function renderConfigToml(params: RenderConfigTomlParams): string {
  const substituted = params.template
    .replaceAll("{PROJECT_NAME}", params.projectName)
    .replaceAll("{PROJECT_DIR}", params.projectDir)
    .replaceAll("{GITHUB_TOKEN}", "${GITHUB_TOKEN}");

  if (!params.mcp) {
    return substituted;
  }
  return `${substituted.trimEnd()}\n\n${renderMcpServers(params.mcp)}\n`;
}

function renderMcpServers(mcp: McpJson): string {
  // #568 — 날짜를 찍지 않는다. 출력이 날마다 바뀌면 아무것도 안 바뀐 update 도 이 파일을 다시 쓰고
  // "갱신했다"로 센다. 원천도 이제 `.mcp.json` 이 아니라 템플릿 + 트랙 표다(`renderHarnessMcp`).
  const blocks = Object.entries(mcp.mcpServers).map(([name, cfg]) => {
    const lines = [`[mcp_servers.${quoteIfNeeded(name)}]`];
    lines.push(`command = ${jsonString(cfg.command)}`);
    lines.push(`args = ${JSON.stringify(cfg.args)}`);
    if (cfg.env && Object.keys(cfg.env).length > 0) {
      const envBody = Object.entries(cfg.env)
        .map(([k, v]) => `${k} = ${jsonString(v)}`)
        .join(", ");
      lines.push(`env = { ${envBody} }`);
    }
    return lines.join("\n");
  });

  return blocks.join("\n\n");
}

function jsonString(s: string): string {
  return JSON.stringify(s);
}

function quoteIfNeeded(name: string): string {
  return /^[A-Za-z0-9_-]+$/.test(name) ? name : `"${name}"`;
}
