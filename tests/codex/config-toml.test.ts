import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readToml } from "../../src/adapters/toml-region.js";
import { renderConfigToml } from "../../src/codex/config-toml.js";

const TEMPLATE = `# Codex config — {PROJECT_NAME}
project_dir = "{PROJECT_DIR}"

[sandbox_workspace_write]
writable_roots = ["{PROJECT_DIR}", "/tmp"]

[features]
codex_hooks = true

# ============================================================
# MCP Servers — defaults
# ============================================================

[mcp_servers.context7]
command = "npx"
args = ["-y"]

# Railway MCP placeholder
# [mcp_servers.railway]
# command = "npx"
`;

describe("renderConfigToml", () => {
  it("substitutes {PROJECT_NAME}, {PROJECT_DIR}", () => {
    const out = renderConfigToml({
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
    });
    expect(out).toContain("# Codex config — demo");
    expect(out).toContain('project_dir = "/p"');
    expect(out).toContain("/p");
  });

  it("preserves the [features] block", () => {
    const out = renderConfigToml({
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
    });
    expect(out).toContain("codex_hooks = true");
  });

  it("appends one [mcp_servers.X] block per supplied server", () => {
    const out = renderConfigToml({
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
      mcp: {
        mcpServers: {
          custom: { command: "node", args: ["x.js"] },
        },
      },
    });
    expect(out).toContain("[mcp_servers.custom]");
    expect(out).toContain('command = "node"');
    expect(out).toContain('args = ["x.js"]');
  });

  // #563 — 서버 원천은 하네스 MCP 하나다. 배포 템플릿에 살아 있는 `[mcp_servers.*]` 가 있으면 렌더가 그것을 줄 단위로
  // 걷어내야 하고(옛 `stripExistingMcpSection`), 안 걷으면 트랙 표에 없는 서버가 Codex 에만 깔린다.
  it("the shipped template carries no live [mcp_servers.*] — the harness servers are the only source", () => {
    const shipped = readFileSync(
      join(__dirname, "../../templates/codex/config.toml.template"),
      "utf8",
    );
    const out = renderConfigToml({
      template: shipped,
      projectName: "demo",
      projectDir: "/p",
      mcp: { mcpServers: { custom: { command: "node", args: ["x.js"] } } },
    });
    expect(Object.keys(readToml(out)?.mcp_servers ?? {})).toEqual(["custom"]);
  });

  it("emits env block when mcpServers entry has env", () => {
    const out = renderConfigToml({
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
      mcp: {
        mcpServers: {
          gh: {
            command: "npx",
            args: ["-y", "@gh/mcp"],
            env: { TOKEN: "xyz" },
          },
        },
      },
    });
    expect(out).toContain("[mcp_servers.gh]");
    expect(out).toContain('env = { TOKEN = "xyz" }');
  });

  // #568 — 같은 입력이면 날이 바뀌어도 같은 출력이다. 날짜를 찍으면 아무것도 안 바뀐 update 가
  // 날마다 이 파일을 다시 쓰고 "갱신했다"로 센다(쓰기 판정은 내용 비교다 — owned-write).
  it("MCP section does not depend on the date (update stays quiet)", () => {
    const params = {
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
      mcp: { mcpServers: { custom: { command: "node", args: ["x.js"] } } },
    };
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const first = renderConfigToml(params);
      vi.setSystemTime(new Date("2026-12-31T00:00:00Z"));
      expect(renderConfigToml(params)).toBe(first);
    } finally {
      vi.useRealTimers();
    }
  });

  it("quotes mcp names with non-identifier characters", () => {
    const out = renderConfigToml({
      template: TEMPLATE,
      projectName: "demo",
      projectDir: "/p",
      mcp: {
        mcpServers: {
          "weird name": { command: "x", args: [] },
        },
      },
    });
    expect(out).toContain('[mcp_servers."weird name"]');
  });
});
