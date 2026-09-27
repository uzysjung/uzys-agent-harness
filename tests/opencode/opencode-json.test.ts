import { describe, expect, it } from "vitest";
import { renderOpencodeJson } from "../../src/opencode/opencode-json.js";

const TEMPLATE = `{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [".claude/rules/*.md"],
  "mcp": {
    "placeholder": { "command": "noop", "args": [] }
  },
  "command": {},
  "agent": {
    "build": { "mode": "primary" }
  },
  "plugin": ["./.opencode/plugins/uzys-harness.ts"],
  "permission": { "question": "allow" }
}
`;

describe("opencode/opencode-json renderOpencodeJson", () => {
  it("preserves $schema, instructions, command, agent, plugin, permission keys when no mcp provided", () => {
    const out = renderOpencodeJson({ template: TEMPLATE });
    const parsed = JSON.parse(out);
    expect(parsed.$schema).toBe("https://opencode.ai/config.json");
    expect(parsed.instructions).toEqual([".claude/rules/*.md"]);
    expect(parsed.command).toEqual({});
    expect(parsed.agent.build.mode).toBe("primary");
    expect(parsed.plugin).toEqual(["./.opencode/plugins/uzys-harness.ts"]);
    expect(parsed.permission.question).toBe("allow");
    // template default mcp untouched when no .mcp.json
    expect(parsed.mcp.placeholder).toBeDefined();
  });

  // #568 — OpenCode 형식(`McpLocalConfig`)으로 옮긴다. Claude 형식({command, args, env})을 그대로
  // 넣으면 OpenCode 가 설정 파일 전체를 거절한다(opencode 1.18.32 실측: "Configuration is invalid").
  it("replaces mcp.<name> from the harness servers in OpenCode local format", () => {
    const out = renderOpencodeJson({
      template: TEMPLATE,
      mcp: {
        mcpServers: {
          context7: { command: "npx", args: ["-y", "@context7/mcp-server"] },
          github: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-github"],
            env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
          },
        },
      },
    });
    const parsed = JSON.parse(out);
    expect(parsed.mcp.context7).toEqual({
      type: "local",
      command: ["npx", "-y", "@context7/mcp-server"],
    });
    expect(parsed.mcp.github).toEqual({
      type: "local",
      command: ["npx", "-y", "@modelcontextprotocol/server-github"],
      environment: { GITHUB_TOKEN: "${GITHUB_TOKEN}" },
    });
    // template default removed
    expect(parsed.mcp.placeholder).toBeUndefined();
  });

  it("throws on invalid JSON template", () => {
    expect(() => renderOpencodeJson({ template: "{ not json" })).toThrow(/invalid JSON/);
  });
});
