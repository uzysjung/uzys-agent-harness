import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shouldRunInteractive } from "../src/commands/uninstall.js";
import { type InstallLog, installLogPath } from "../src/install-log.js";
import {
  buildRemovableRows,
  runInteractiveUninstall,
  type UninstallPrompts,
} from "../src/uninstall-interactive.js";

/**
 * v26.125.0 (사용자 요청) — `uninstall` 을 실행하면 **무엇을 뺄지 고르는 화면**으로 들어간다.
 * install 위저드의 체크 해제는 여전히 아무것도 지우지 않는다 — 제거는 이 명령 전용이다
 * (사용자 결정: "B는 install 에서 체크해제고 uninstall 을 별도로 실행해서 들어가도록").
 */
function writeLog(dir: string, assets: InstallLog["assets"]): void {
  mkdirSync(join(dir, ".claude"), { recursive: true });
  const log: InstallLog = {
    schemaVersion: 1,
    installedAt: "2026-07-19T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: { claudeDir: ".claude/" },
    assets,
  };
  writeFileSync(installLogPath(dir), JSON.stringify(log), "utf8");
}

const asset = (id: string, scope: "project" | "global" = "project") => ({
  id,
  category: "dev-tools",
  method: "plugin" as const,
  scope,
  detail: {},
});

function mkPrompts(over: Partial<UninstallPrompts> = {}): UninstallPrompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectMode: vi.fn(async () => "selected" as const),
    selectAssets: vi.fn(async () => [] as string[]),
    confirm: vi.fn(async () => true),
    ...over,
  };
}

describe("buildRemovableRows — 무엇을 고를 수 있는가", () => {
  it("global 자산은 자동 제거 대상이 아님을 라벨에 표시한다 (D16)", () => {
    const rows = buildRemovableRows([asset("p"), asset("g", "global")]);
    expect(rows.find((r) => r.value === "g")?.hint).toContain("수기");
    expect(rows.find((r) => r.value === "p")?.hint).not.toContain("수기");
  });

  it("자동 되돌리기 경로가 없는 method 는 그렇다고 말한다 — 골라도 안 지워지는 걸 숨기지 않는다", () => {
    const rows = buildRemovableRows([
      { id: "b", category: "workflow", method: "npx-run", scope: "project", detail: {} },
    ]);
    expect(rows[0]?.hint).toContain("자동 되돌리기 경로 없음");
  });

  it("아무것도 없으면 빈 목록", () => {
    expect(buildRemovableRows([])).toEqual([]);
  });
});

describe("runInteractiveUninstall", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-uni-i-"));
  });

  function run(prompts: UninstallPrompts, isTty = true) {
    return runInteractiveUninstall(dir, { prompts, isTty: () => isTty });
  }

  it("TTY 가 아니면 대화형으로 들어가지 않는다 — CI 에서 프롬프트가 뜨면 멈춘다", async () => {
    writeLog(dir, [asset("p")]);
    const r = await run(mkPrompts(), false);
    expect(r).toEqual({ ok: false, reason: "no-tty" });
    rmSync(dir, { recursive: true, force: true });
  });

  it("로그가 없으면 안내하고 끝낸다", async () => {
    const r = await run(mkPrompts());
    expect(r.reason).toBe("no-log");
    rmSync(dir, { recursive: true, force: true });
  });

  it("항목을 고르면 그 id 만 --only 로 넘어간다", async () => {
    writeLog(dir, [asset("a"), asset("b")]);
    const r = await run(mkPrompts({ selectAssets: vi.fn(async () => ["a"]) }));
    expect(r).toMatchObject({ ok: true, options: { only: "a" } });
    rmSync(dir, { recursive: true, force: true });
  });

  it("아무것도 안 고르면 아무 일도 일어나지 않는다 — 빈 선택이 전량 제거로 새면 안 된다", async () => {
    writeLog(dir, [asset("a")]);
    const r = await run(mkPrompts({ selectAssets: vi.fn(async () => []) }));
    expect(r).toMatchObject({ ok: false, reason: "nothing-selected" });
    rmSync(dir, { recursive: true, force: true });
  });

  it("전량 모드는 --only 없이 넘어간다 (templates 포함 제거)", async () => {
    writeLog(dir, [asset("a")]);
    const r = await run(mkPrompts({ selectMode: vi.fn(async () => "all" as const) }));
    expect(r).toMatchObject({ ok: true });
    expect(r.options?.only).toBeUndefined();
    rmSync(dir, { recursive: true, force: true });
  });

  it("확인에서 거절하면 실행하지 않는다", async () => {
    writeLog(dir, [asset("a")]);
    const r = await run(
      mkPrompts({ selectAssets: vi.fn(async () => ["a"]), confirm: vi.fn(async () => false) }),
    );
    expect(r).toMatchObject({ ok: false, reason: "cancelled" });
    rmSync(dir, { recursive: true, force: true });
  });

  it("모드 선택에서 ESC 하면 취소", async () => {
    writeLog(dir, [asset("a")]);
    const r = await run(mkPrompts({ selectMode: vi.fn(async () => null) }));
    expect(r).toMatchObject({ ok: false, reason: "cancelled" });
    rmSync(dir, { recursive: true, force: true });
  });

  it("전량 모드 확인 문구에 templates 가 사라진다는 사실이 들어간다", async () => {
    writeLog(dir, [asset("a")]);
    const confirm = vi.fn(async (_summary: string) => false);
    await run(mkPrompts({ selectMode: vi.fn(async () => "all" as const), confirm }));
    expect(confirm.mock.calls[0]?.[0]).toContain(".claude/");
    rmSync(dir, { recursive: true, force: true });
  });
});

/**
 * 플래그 없는 `uninstall` 이 즉시 전량 삭제하던 것이 이 명령의 가장 위험한 기본값이었다.
 * 이제 TTY 면 선택 화면으로 들어간다 — 단, 사용자가 이미 무엇을 원하는지 말한 경우
 * (`--only`/`--dry-run`/`--yes`)와 CI(비 TTY)에서는 기존 동작 그대로여야 한다.
 */
describe("shouldRunInteractive — 언제 화면으로 들어가는가", () => {
  it("TTY + 플래그 없음 → 화면", () => {
    expect(shouldRunInteractive({}, true)).toBe(true);
  });

  it("비 TTY → 절대 안 들어간다 (CI 가 프롬프트에서 멈추면 안 된다)", () => {
    expect(shouldRunInteractive({}, false)).toBe(false);
  });

  it("--only 는 이미 대상을 지정한 것이라 화면 없이 그대로 실행", () => {
    expect(shouldRunInteractive({ only: "a" }, true)).toBe(false);
  });

  it("--dry-run 은 미리보기라 화면 없이 그대로 실행", () => {
    expect(shouldRunInteractive({ dryRun: true }, true)).toBe(false);
  });

  it("--yes 는 묻지 말라는 명시", () => {
    expect(shouldRunInteractive({ yes: true }, true)).toBe(false);
  });

  it("--keep-templates 만 준 경우는 대상을 지정한 게 아니라 화면으로 들어간다", () => {
    expect(shouldRunInteractive({ keepTemplates: true }, true)).toBe(true);
  });
});
