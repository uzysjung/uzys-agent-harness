import { describe, expect, it, vi } from "vitest";
import { buildCli, defaultAction, VERSION } from "../src/cli.js";
import type { InteractiveResult } from "../src/interactive.js";
import { isCliBase } from "../src/types.js";

describe("buildCli", () => {
  it("returns a cac instance with the expected name", () => {
    const cli = buildCli();
    expect(cli.name).toBe("claude-harness");
  });

  it("exposes the current version string in semver shape", () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });

  it("registers the install subcommand", () => {
    const cli = buildCli();
    const installCmd = cli.commands.find((cmd) => cmd.name === "install");
    expect(installCmd).toBeDefined();
    expect(installCmd?.description).toContain("Install");
  });

  it("registers --cli, --track, --project-dir options on install", () => {
    const cli = buildCli();
    const installCmd = cli.commands.find((cmd) => cmd.name === "install");
    const optionNames = installCmd?.options.map((o) => o.name) ?? [];
    // cac normalizes flag names to camelCase
    expect(optionNames).toEqual(expect.arrayContaining(["cli", "track", "projectDir"]));
  });

  it("registers all 5 with-* boolean options on install", () => {
    const cli = buildCli();
    const installCmd = cli.commands.find((cmd) => cmd.name === "install");
    const optionNames = installCmd?.options.map((o) => o.name) ?? [];
    expect(optionNames).toEqual(
      expect.arrayContaining(["withTauri", "withGsd", "withEcc", "withPrune", "withTob"]),
    );
  });

  it("registers an explicit empty default command (interactive placeholder)", () => {
    const cli = buildCli();
    const defaultCmd = cli.commands.find((cmd) => cmd.name === "");
    expect(defaultCmd).toBeDefined();
  });

  it("default command has the interactive description label", () => {
    const cli = buildCli();
    const defaultCmd = cli.commands.find((cmd) => cmd.name === "");
    expect(defaultCmd?.description).toContain("Interactive");
  });
});

describe("defaultAction", () => {
  it("calls executeSpec with the captured spec when interactive returns ok=true", async () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const execute = vi.fn();
    const spec = {
      tracks: ["tooling"] as const,
      options: {
        withTauri: false,
        withGsd: false,
        withEcc: false,
        withPrune: false,
        withTob: false,
        withCodexSkills: false,
        withCodexTrust: false,
        withKarpathyHook: false,
        withCodexPrompts: false,
        withAddyAgentSkills: false,
        withUzysHarness: false,
        withSuperpowers: false,
      },
      cli: ["claude"] as const,
      projectDir: "/p",
    };
    const run = vi.fn(
      async (): Promise<InteractiveResult> => ({
        ok: true,
        spec: { ...spec, tracks: [...spec.tracks] },
      }),
    );
    await defaultAction({ log, err, exit, run, execute });
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0]?.[0]).toMatchObject({ tracks: ["tooling"], cli: ["claude"] });
    expect(exit).not.toHaveBeenCalled();
  });

  it("calls err + exit(1) when interactive returns ok=true but no spec (internal error)", async () => {
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const execute = vi.fn();
    const run = vi.fn(async (): Promise<InteractiveResult> => ({ ok: true }));
    await defaultAction({ err, exit, run, execute });
    expect(err).toHaveBeenCalledWith(expect.stringContaining("Internal error"));
    expect(exit).toHaveBeenCalledWith(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("calls exit(2) on no-tty", async () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const run = vi.fn(async () => ({
      ok: false as const,
      reason: "no-tty" as const,
      message: "no tty",
    }));
    await defaultAction({ log, err, exit, run });
    expect(err).toHaveBeenCalledWith("no tty");
    expect(exit).toHaveBeenCalledWith(2);
  });

  it("calls exit(0) on cancellation/exit/disabled with no message", async () => {
    const log = vi.fn();
    const err = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    const run = vi.fn(async () => ({
      ok: false as const,
      reason: "cancelled" as const,
    }));
    await defaultAction({ log, err, exit, run });
    expect(err).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("uses default deps without throwing for the no-tty path", async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const exit = vi.fn() as unknown as (code: number) => never;
    const err = vi.fn();
    try {
      await defaultAction({ exit, err });
    } finally {
      Object.defineProperty(process.stdin, "isTTY", { value: original, configurable: true });
    }
    expect(exit).toHaveBeenCalledWith(2);
  });
});

describe("isCliBase (v0.8.0 — replaces isCliMode)", () => {
  it.each(["claude", "codex", "opencode"])("accepts %s as a valid CLI base", (base) => {
    expect(isCliBase(base)).toBe(true);
  });

  it.each([
    null,
    undefined,
    "",
    "invalid",
    "both",
    "all",
    1,
    true,
    {},
  ])("rejects %s as an invalid CLI base (v0.8.0 — both/all alias removed)", (value) => {
    expect(isCliBase(value)).toBe(false);
  });
});
