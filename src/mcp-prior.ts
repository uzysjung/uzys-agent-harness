/**
 * #722 (ADR-106) — 하네스가 **전에** `.mcp.json` 에 쓴 서버 값. 옛 판이 쓴 값을 알아보는 한 자리다(ADR-100 의
 * `RETIRED_GITIGNORE_LINES` 와 같은 자리 · 같은 뜻):
 *
 *   ① 옛 로그(몫 기록 전 — v26.161 이하)의 내용 식별(`legacyMcpSeed` · `legacyMcpServers`) — 하네스가 만든 파일
 *      (`rootFiles.change === "created"` 기록)에서 이 값 그대로 남은 서버만 하네스 몫으로 본다.
 *   ② uninstall 의 잔존 안내(`remnantFor`) — 알리기만 한다.
 *   ③ 화면 — 은퇴(`retired`)·교체(`updated`) 한 줄의 까닭.
 *
 * **지우는 근거가 되는 것은 은퇴한 이름뿐이다**(`retired` 가 있는 항목 — 하네스가 더는 어떤 트랙에도 렌더하지 않는다).
 * 트랙 표에 살아 있는 이름은 옛 로그에서 알아봐도 **선택 근거로만** 넘긴다 — 같은 디스크가 이전 판과 무관하게 기록 있는
 * 설치본과 같은 결과(남기고 새 값으로 갈아 끼움)를 받는다(설계 검증 B1 ⓐ).
 */

import type { McpServerConfig } from "./mcp-merge.js";

export interface PriorMcpServer {
  name: string;
  /** 그때 하네스가 쓴 값(내부 모델 — stdio 는 Claude `.mcp.json` 형식과 같다). */
  value: McpServerConfig;
  /** 은퇴한 이름이면 화면이 덧붙이는 까닭과 대안. 없으면 살아 있는 이름(트랙 표 행)이다. */
  retired?: string;
  /** 살아 있는 이름을 새 값으로 갈아 끼웠을 때 화면이 덧붙이는 한 마디. */
  updated?: string;
}

export const PRIOR_MCP_SERVERS: ReadonlyArray<PriorMcpServer> = [
  {
    name: "github",
    value: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
    retired:
      "the old @modelcontextprotocol/server-github is deprecated upstream and ran without a token. The agent uses the gh CLI for GitHub; to use GitHub's official MCP instead: agent-harness install … --with github-mcp (needs GITHUB_PAT)",
  },
  {
    name: "railway-mcp-server",
    value: { type: "stdio", command: "npx", args: ["-y", "@railway/mcp-server"] },
    updated: "now Railway's remote server — sign in on first use, see NEXT",
  },
  {
    name: "chrome-devtools",
    value: { type: "stdio", command: "npx", args: ["-y", "chrome-devtools-mcp@latest"] },
    updated: "usage statistics off",
  },
];

/** 이 이름으로 하네스가 전에 쓴 값들. */
export function priorMcpValues(name: string): McpServerConfig[] {
  return PRIOR_MCP_SERVERS.filter((p) => p.name === name).map((p) => p.value);
}

/** 은퇴한 이름 — 옛 로그에서 값이 그대로면 지우는 근거가 된다. */
export function retiredMcpNames(): string[] {
  return PRIOR_MCP_SERVERS.filter((p) => p.retired !== undefined).map((p) => p.name);
}
