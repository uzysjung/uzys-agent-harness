/**
 * #935 — htmx 의 Hono 백엔드 트랙 `ssr-htmx-hono`(Hono + hono/jsx + daisyUI).
 *
 * 같은 서버 JSX(`.tsx`)라도 Fastify(@kitajs/html)와 이스케이프 기본값·테스트 도구가 달라 화면 룰을 따로 받는다.
 * 새 트랙은 `ssr-htmx-fastify` 와 **같은 기본 자산**(위저드 3단계 체크 · railway MCP 포함)을 받고, 화면 룰
 * `htmx-hono-ui` 는 고른 CLI 마다 그 CLI 가 읽는 자리에 깔린다. `full` 은 받지 않는다(AGENTS.md 벤더 상한, #820).
 * 백엔드별 룰이 섞이지 않는 것은 `installer-11-track` 의 "UI 트랙 룰 라우팅" 이 잰다.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFromOptions } from "../src/commands/install.js";
import { runInstall } from "../src/installer.js";
import { initialTargetSelection } from "../src/interactive.js";
import { pathRulePointerTargets } from "../src/rules-port.js";
import { CLI_BASES, DEFAULT_OPTIONS, type Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const RAILWAY = "railway-mcp-server";
const RULE = "htmx-hono-ui";

const dirs: string[] = [];
let mk: () => string;
beforeEach(() => {
  mk = () => {
    const d = mkdtempSync(join(tmpdir(), "ah-935-"));
    dirs.push(d);
    return d;
  };
});
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** 네 CLI 를 함께 골라 설치한 프로젝트 디렉터리. */
function installAll(tracks: Track[]): string {
  const dir = mk();
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: { tracks, options: { ...DEFAULT_OPTIONS }, cli: [...CLI_BASES], projectDir: dir },
  });
  return dir;
}

/** 설치 뒤 세 자리(`.mcp.json` · Codex · OpenCode)의 MCP 서버 이름. */
function installedServers(dir: string): { mcp: string[]; opencode: string[]; codex: string[] } {
  const mcp = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")) as {
    mcpServers: Record<string, unknown>;
  };
  const opencode = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")) as {
    mcp?: Record<string, unknown>;
  };
  const toml = readFileSync(join(dir, ".codex/config.toml"), "utf8");
  return {
    mcp: Object.keys(mcp.mcpServers).sort(),
    opencode: Object.keys(opencode.mcp ?? {}).sort(),
    codex: [...toml.matchAll(/^\[mcp_servers\.([^\].]+)\]/gm)].map((m) => m[1] ?? "").sort(),
  };
}

/** 룰 본문의 제목 줄 — 문구를 여기 박지 않고 배포 룰에서 읽는다(AGENTS.md 인라인 부재 판정용). */
function ruleHeading(): string {
  const body = readFileSync(join(HARNESS_ROOT, `templates/rules/${RULE}.md`), "utf8");
  const heading = body.split("\n").find((l) => l.startsWith("# "));
  if (heading === undefined) throw new Error(`${RULE} 에 제목 줄이 없다`);
  return heading.slice(2);
}

describe("#935 — ssr-htmx-hono 트랙", () => {
  it("--track ssr-htmx-hono 를 받는다", () => {
    expect(specFromOptions({ track: ["ssr-htmx-hono"], cli: "claude" }).ok).toBe(true);
    // 대조군 — 없는 트랙은 거절한다(검증이 모든 값을 통과시키는 상태가 아님을 보인다).
    expect(specFromOptions({ track: ["ssr-htmx-honox"], cli: "claude" }).ok).toBe(false);
  });

  it("위저드 3단계에 ssr-htmx-fastify 와 같은 자산이 체크된 채 보인다 — railway · frontend-design 포함", () => {
    // 자산 줄만 비교한다 — 기본 구성(baseline:) 줄은 화면 룰이 백엔드별로 다르다.
    const assets = (t: Track) =>
      initialTargetSelection([t], []).filter((id) => id.startsWith("asset:"));
    const hono = assets("ssr-htmx-hono");
    expect(hono).toEqual(assets("ssr-htmx-fastify"));
    expect(hono).toContain(`asset:${RAILWAY}`);
    expect(hono).toContain("asset:frontend-design");
  });

  it("네 CLI 에 깔면 Hono 화면 룰이 CLI 마다 읽는 자리에 도달하고, MCP 서버는 ssr-htmx-fastify 와 같다", () => {
    const dir = installAll(["ssr-htmx-hono"]);
    expect(existsSync(join(dir, `.claude/rules/${RULE}.md`)), "Claude Code").toBe(true);
    expect(existsSync(join(dir, `.agents/rules/${RULE}.md`)), "Antigravity").toBe(true);
    // Codex · OpenCode 는 루트 AGENTS.md 의 경로 룰 포인터로 Antigravity 가 쓴 그 파일을 읽는다(#960 · ADR-119 — 전에는 본문 인라인).
    expect(pathRulePointerTargets(readFileSync(join(dir, "AGENTS.md"), "utf8"))).toContain(
      `.agents/rules/${RULE}.md`,
    );

    const servers = installedServers(dir);
    expect(servers).toEqual(installedServers(installAll(["ssr-htmx-fastify"])));
    for (const where of [servers.mcp, servers.opencode, servers.codex]) {
      expect(where).toContain(RAILWAY);
    }
  });

  it("full 은 Hono 화면 룰을 받지 않는다 — 네 자리 어디에도 없다", () => {
    const dir = installAll(["full"]);
    // 대조군 — 같은 설치가 full 의 룰은 깔았다(빈 rules 디렉터리로 통과하지 않게).
    expect(existsSync(join(dir, ".claude/rules/cli-development.md"))).toBe(true);
    expect(existsSync(join(dir, `.claude/rules/${RULE}.md`))).toBe(false);
    expect(existsSync(join(dir, `.agents/rules/${RULE}.md`))).toBe(false);
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf8");
    expect(agents).not.toContain(ruleHeading());
    expect(pathRulePointerTargets(agents), "대조군 — full 의 경로 룰은 가리킨다").toContain(
      ".agents/rules/cli-development.md",
    );
    expect(pathRulePointerTargets(agents)).not.toContain(`.agents/rules/${RULE}.md`);
  });
});
