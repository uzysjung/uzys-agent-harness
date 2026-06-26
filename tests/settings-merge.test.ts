import { describe, expect, it } from "vitest";
import { addPreToolUseHook, type ClaudeSettings } from "../src/settings-merge.js";

const KARPATHY_CMD = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"';

describe("addPreToolUseHook", () => {
  it("creates hooks.PreToolUse when settings has no hooks key", () => {
    const settings: ClaudeSettings = { statusLine: { type: "command", command: "echo" } };
    const result = addPreToolUseHook(settings, "Write|Edit", KARPATHY_CMD);
    const preToolUse = result.hooks?.PreToolUse;
    expect(preToolUse).toBeDefined();
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse?.[0]).toEqual({
      matcher: "Write|Edit",
      hooks: [{ type: "command", command: KARPATHY_CMD }],
    });
    // statusLine 보존
    expect(result.statusLine).toEqual({ type: "command", command: "echo" });
  });

  it("is idempotent — second call with same matcher+command does not duplicate", () => {
    const settings: ClaudeSettings = {};
    const once = addPreToolUseHook(settings, "Write|Edit", KARPATHY_CMD);
    const twice = addPreToolUseHook(once, "Write|Edit", KARPATHY_CMD);
    const preToolUse = twice.hooks?.PreToolUse;
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse?.[0]?.hooks).toHaveLength(1);
  });

  it("appends to existing matcher entry without removing other hooks", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Write|Edit",
            hooks: [
              {
                type: "command",
                command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-files.sh"',
              },
            ],
          },
        ],
      },
    };
    const result = addPreToolUseHook(existing, "Write|Edit", KARPATHY_CMD);
    const preToolUse = result.hooks?.PreToolUse;
    expect(preToolUse).toHaveLength(1);
    expect(preToolUse?.[0]?.hooks).toHaveLength(2);
    expect(preToolUse?.[0]?.hooks.map((h) => h.command)).toContain(KARPATHY_CMD);
    // 기존 protect-files hook 보존
    expect(preToolUse?.[0]?.hooks[0]?.command).toContain("protect-files.sh");
  });

  it("preserves other matcher entries (e.g. Skill, mcp__.*)", () => {
    const existing: ClaudeSettings = {
      hooks: {
        PreToolUse: [
          {
            matcher: "Skill",
            hooks: [
              {
                type: "command",
                command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.sh"',
              },
            ],
          },
          {
            matcher: "mcp__.*",
            hooks: [
              {
                type: "command",
                command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/mcp-pre-exec.sh"',
              },
            ],
          },
        ],
      },
    };
    const result = addPreToolUseHook(existing, "Write|Edit", KARPATHY_CMD);
    expect(result.hooks?.PreToolUse).toHaveLength(3);
    const matchers = result.hooks?.PreToolUse?.map((m) => m.matcher);
    expect(matchers).toContain("Write|Edit");
    expect(matchers).toContain("Skill");
    expect(matchers).toContain("mcp__.*");
  });

  it("does not mutate the input settings object", () => {
    const settings: ClaudeSettings = { hooks: { PreToolUse: [] } };
    const snapshot = JSON.stringify(settings);
    addPreToolUseHook(settings, "Write|Edit", KARPATHY_CMD);
    expect(JSON.stringify(settings)).toBe(snapshot);
  });
});
