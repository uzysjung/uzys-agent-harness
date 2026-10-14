/**
 * #820 — htmx 트랙을 백엔드별 둘로 나눴다: `ssr-htmx`(FastAPI · id 유지) · `ssr-htmx-fastify`(Node).
 *
 * 새 트랙은 `ssr-htmx` 와 **같은 기본 자산**(위저드 3단계 체크 · railway MCP 포함)을 받는다. 화면 룰이 백엔드별로
 * 갈리는 것은 `installer-11-track` 의 "UI 트랙 룰 라우팅" 이 잰다.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { specFromOptions } from "../src/commands/install.js";
import { hashContent, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { initialTargetSelection } from "../src/interactive.js";
import { DEFAULT_OPTIONS, type Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const RAILWAY = "railway-mcp-server";

const dirs: string[] = [];
let mk: () => string;
beforeEach(() => {
  mk = () => {
    const d = mkdtempSync(join(tmpdir(), "ah-820-"));
    dirs.push(d);
    return d;
  };
});
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** 설치 뒤 세 자리(`.mcp.json` · Codex · OpenCode)의 MCP 서버 이름. */
function installedServers(track: Track): { mcp: string[]; opencode: string[]; codex: string[] } {
  const dir = mk();
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: {
      tracks: [track],
      options: { ...DEFAULT_OPTIONS },
      cli: ["claude", "codex", "opencode"],
      projectDir: dir,
    },
  });
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

describe("#820 — ssr-htmx-fastify 트랙", () => {
  it("--track ssr-htmx-fastify 를 받는다 — 옛 id ssr-htmx 도 그대로 받는다", () => {
    for (const t of ["ssr-htmx-fastify", "ssr-htmx"]) {
      expect(specFromOptions({ track: [t], cli: "claude" }).ok, t).toBe(true);
    }
    // 대조군 — 없는 트랙은 거절한다(검증이 모든 값을 통과시키는 상태가 아님을 보인다).
    expect(specFromOptions({ track: ["ssr-htmx-node"], cli: "claude" }).ok).toBe(false);
  });

  it("위저드 3단계에 ssr-htmx 와 같은 자산이 체크된 채 보인다 — railway 포함", () => {
    // 자산 줄만 비교한다 — 기본 구성(baseline:) 줄은 화면 룰이 백엔드별로 다르다(htmx-fastapi-ui · htmx-fastify-ui).
    const assets = (t: Track) =>
      initialTargetSelection([t], []).filter((id) => id.startsWith("asset:"));
    const fastify = assets("ssr-htmx-fastify");
    expect(fastify).toEqual(assets("ssr-htmx"));
    expect(fastify).toContain(`asset:${RAILWAY}`);
    expect(fastify).toContain("asset:frontend-design");
  });

  it("설치하면 ssr-htmx 와 같은 MCP 서버가 세 자리에 깔린다 — railway 포함", () => {
    const fastify = installedServers("ssr-htmx-fastify");
    expect(fastify).toEqual(installedServers("ssr-htmx"));
    for (const where of [fastify.mcp, fastify.opencode, fastify.codex]) {
      expect(where).toContain(RAILWAY);
    }
  });

  it("#820 이전 ssr-htmx 설치본의 update 는 트랙 id 를 그대로 두고 FastAPI 화면 룰을 더한다", () => {
    const dir = mk();
    const spec = {
      tracks: ["ssr-htmx"] as Track[],
      options: { ...DEFAULT_OPTIONS },
      cli: ["claude"] as const,
      projectDir: dir,
    };
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir: dir, spec });
    // #820 이전 판의 디스크·기록으로 되돌린다 — htmx 룰이 없고 React 룰(ui-components)이 하네스 것으로 깔려 있다.
    const rules = join(dir, ".claude/rules");
    rmSync(join(rules, "htmx-fastapi-ui.md"));
    const ui = readFileSync(join(HARNESS_ROOT, "templates/rules/ui-components.md"), "utf8");
    writeFileSync(join(rules, "ui-components.md"), ui);
    const old = readInstallLog(dir);
    if (old === null) throw new Error("install log missing");
    writeInstallLog(dir, {
      ...old,
      policyFiles: [
        ...(old.policyFiles ?? []).filter((f) => f.path !== "rules/htmx-fastapi-ui.md"),
        { path: "rules/ui-components.md", sha256: hashContent(ui) },
      ],
    });

    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      spec,
      mode: "update",
    });

    expect(readInstallLog(dir)?.spec.tracks).toEqual(["ssr-htmx"]);
    expect(existsSync(join(rules, "htmx-fastapi-ui.md"))).toBe(true);
    expect(existsSync(join(rules, "htmx-fastify-ui.md"))).toBe(false);
  });
});
