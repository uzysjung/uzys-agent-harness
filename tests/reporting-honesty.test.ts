/**
 * #613/#617/#607/#626/#637 — 보고 정직성(H 클러스터) 1차.
 *
 * - #613: --track 누락/빈값이 "Unknown track: undefined"/"0" 이라는 입력한 적 없는 값을
 *   오류의 주어로 삼지 않는다.
 * - #617: --track 중복이 dedup 돼 기록·스펙에 한 번만 남는다(--cli 와 대칭).
 * - #607: uninstall --dry-run 계획에 설치 기록 제거 스텝이 있다(실행이 수행하는 마지막 단계).
 * - #626: --keep-templates 의 잔여 안내 헤더가 ".claude/ 밖" 을 참말로 만든다.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installSpecFromOptions, specFromOptions } from "../src/commands/install.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-h1-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

describe("#613 — 센티널 트랙 값의 오류 문구", () => {
  it('옵션 누락(undefined 문자열 센티널)은 "Unknown track: undefined" 가 아니다', () => {
    const r = specFromOptions({ track: ["undefined"] as never, cli: ["claude"] });
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("Unknown track: undefined");
    expect(r.message).toContain("--track");
  });

  it('눇값(숫자 0 센티널)은 "Unknown track: 0" 이 아니다', () => {
    const r = specFromOptions({ track: ["0"] as never, cli: ["claude"] });
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain("Unknown track: 0");
  });

  it("진짜 오타는 여전히 Unknown track 로 거부한다", () => {
    const r = specFromOptions({ track: ["no-such"], cli: ["claude"] });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Unknown track: no-such");
  });
});

describe("#617 — 트랙 dedup", () => {
  it("installSpecFromOptions 가 중복을 한 번으로", () => {
    const err = vi.fn();
    const spec = installSpecFromOptions(
      { track: ["base", "base"], cli: ["claude"] } as never,
      { targets: ["claude"], warnings: [] } as never,
      err,
    );
    expect(spec.tracks).toEqual(["base"]);
    void err;
  });
});

describe("#607/#626 — uninstall 안내", () => {
  const install = () =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["base"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      } as InstallSpec,
    });
  const uninstall = (options: Record<string, unknown>) => {
    const lines: string[] = [];
    uninstallAction({ projectDir, ...options } as never, {
      exit: () => undefined as never,
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      resolveHarnessRoot: () => HARNESS_ROOT,
    });
    return lines;
  };

  it("#607 dry-run 계획에 install record 스텝이 있다", () => {
    install();
    const lines = uninstall({ dryRun: true });
    expect(lines.join("\n")).toContain("remove install record");
  });

  it("#626 keep-templates 잔여 안내 헤더가 '밖' 을 말하지 않는다", () => {
    install();
    const lines = uninstall({ yes: true, keepTemplates: true });
    expect(lines.join("\n")).not.toContain("`.claude/` 밖에 남는 것");
    expect(lines.join("\n")).toMatch(/남는 것/);
  });

  it("기본 경로의 헤더는 그대로다(회귀 방지)", () => {
    install();
    const lines = uninstall({ dryRun: true });
    expect(lines.join("\n")).toContain("`.claude/` 밖에 남는 것");
  });
});
