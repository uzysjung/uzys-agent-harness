import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { readToml } from "../../src/adapters/toml-region.js";
import { isChangedLegacyConfig, renderConfigToml } from "../../src/codex/config-toml.js";

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

// #627 — 하네스가 내는 훅 등록은 현행 codex-cli 스키마(PascalCase + 중첩 hooks + command 문자열)여야
// 실제로 발화한다. flat `session_start` 는 경고 없이 무시됐다. 구간 없는 옛 파일의 이행 판정
// (isChangedLegacyConfig)은 양쪽 형식을 다 본다.
describe("hooks 등록 형식 (#627)", () => {
  it("배포 템플릿이 중첩 SessionStart 형식을 낸다 — command 는 문자열", () => {
    const shipped = readFileSync(
      join(__dirname, "../../templates/codex/config.toml.template"),
      "utf8",
    );
    const out = renderConfigToml({
      template: shipped,
      projectName: "demo",
      projectDir: "/p",
    });
    expect(out).toContain("[[hooks.SessionStart]]");
    expect(out).toContain("[[hooks.SessionStart.hooks]]");
    const parsed = readToml(out);
    const events = (parsed?.hooks as Record<string, unknown> | undefined)?.SessionStart;
    expect(Array.isArray(events)).toBe(true);
    const items = (events as Array<{ hooks?: Array<{ command?: unknown; type?: unknown }> }>)[0]
      ?.hooks;
    expect(items?.[0]?.command).toBe("/p/.codex/hooks/session-start.sh");
    expect(items?.[0]?.type).toBe("command");
  });

  it("flat session_start 는 템플릿에 더 이상 없다", () => {
    const shipped = readFileSync(
      join(__dirname, "../../templates/codex/config.toml.template"),
      "utf8",
    );
    // 주석의 역사 언급은 남는다 — 테이블 선언이 실제로 없는지만 본다.
    expect(shipped.match(/^\[\[hooks\.session_start\]\]/gm)).toBeNull();
  });

  it("isChangedLegacyConfig 가 옛 flat 형식의 하네스 훅도 알아본다", () => {
    const legacyFlat = '[[hooks.session_start]]\ncommand = ["/p/.codex/hooks/session-start.sh"]\n';
    expect(isChangedLegacyConfig(legacyFlat, undefined)).toBe(true);
    expect(isChangedLegacyConfig('model = "o3"\n', undefined)).toBe(false);
  });

  it("isChangedLegacyConfig 가 중첩 형식의 하네스 훅도 알아본다", () => {
    const nested = [
      "[[hooks.SessionStart]]",
      'name = "session-start"',
      "[[hooks.SessionStart.hooks]]",
      'command = "/p/.codex/hooks/session-start.sh"',
      'type = "command"',
      "",
    ].join("\n");
    expect(isChangedLegacyConfig(nested, undefined)).toBe(true);
    // 남의 훅은 하네스 것이 아니다
    const foreign = '[[hooks.SessionStart.hooks]]\ncommand = "/other/hook.sh"\n';
    expect(isChangedLegacyConfig(foreign, undefined)).toBe(false);
  });
});
