import { describe, expect, it, vi } from "vitest";
import { buildCli, defaultAction, VERSION } from "../src/cli.js";
import type { InteractiveResult } from "../src/interactive.js";

describe("buildCli", () => {
  it("VERSION == package.json version (v26.82.1 — 하드코딩 drift 재발 방지)", async () => {
    // WHY: v26.82.0 ship 때 package.json 만 bump 되고 하드코딩 VERSION(26.81.0)이 남아
    //   npm 게시 패키지가 --version 을 거짓 보고 (no-false-ship 위반 클래스).
    //   derive + 본 단언으로 두 값의 분리 자체가 불가능함을 고정.
    const pkg = (await import("../package.json")).default;
    expect(VERSION).toBe(pkg.version);
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

  it("registers behavior option flags + generic --with/--without on install", () => {
    const cli = buildCli();
    const installCmd = cli.commands.find((cmd) => cmd.name === "install");
    const optionNames = installCmd?.options.map((o) => o.name) ?? [];
    // v26.81.0 (ADR-022) — 잔존 = 동작 옵션 + generic 자산 선택만.
    // 6-Gate 제거 — withCodexSkills/withCodexPrompts/withAntigravityGlobal 삭제.
    // 2026-08-02 정비 (ADR-060, BREAKING) — `--with-karpathy-hook` 삭제.
    // #492 — `--with-prune` 삭제 (ECC 자산 은퇴). 남은 동작 옵션은 codex-trust 하나.
    expect(optionNames).toEqual(expect.arrayContaining(["with", "without", "withCodexTrust"]));
    expect(optionNames).not.toContain("withPrune");
    expect(optionNames).not.toContain("withKarpathyHook");
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
        withCodexTrust: false,
        withKarpathyHook: false,
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
