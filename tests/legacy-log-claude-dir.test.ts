import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { installedClis, installLogPath, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = join(HARNESS_ROOT, "templates");

/**
 * #528 리뷰 BLOCKER-1 — **옛 설치 로그에서 설치자 소유 `.claude/` 를 "깔린 CLI" 로 읽지 않는다.**
 *
 * 판정 기준 한 문장: codex 단독으로 깐 옛 설치본(`spec.clis` 없음)에 설치자가 직접 만든
 * `.claude/` 가 있어도 claude 는 깔린 CLI 가 아니다 — 그래서 `uninstall --cli claude` 는
 * 거절되고, `update` 는 그 디렉터리에 아무것도 넣지 않으며, `list` 는 codex 만 말한다.
 *
 * 왜 이 상태가 흔한가: Claude Code 는 권한을 한 번 승인받기만 해도 `.claude/settings.local.json`
 * 을 만든다. 디렉터리 존재를 소유의 단서로 쓰면 하네스가 만든 적 없는 그 트리가
 * `rmSync(recursive)` 로 통째 사라진다(백업·확인 없음). 소유는 기록에서만 나온다
 * (ADR-096 Decision 6).
 */
describe("#528 옛 로그 + 설치자 소유 `.claude/`", () => {
  let projectDir: string;

  const claudeFiles = (): string[] => listFilesRecursive(join(projectDir, ".claude")).sort();

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "legacy528-"));
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["codex"],
        projectDir,
      } satisfies InstallSpec,
    });
    // 픽스처 자기검증 — codex 단독 설치는 `.claude/` 를 만들지 않는다. 그래서 아래에서 만드는
    // 디렉터리는 **설치자 것**이라고 말할 수 있다.
    expect(claudeFiles()).toEqual([]);

    // v26.160.1 이하가 남기던 모양으로 되돌린다: `clis` 필드가 없고, `templates.claudeDir` 는
    // claude 를 고르지 않아도 적혔다(그래서 그 필드는 단서가 될 수 없다).
    const raw = JSON.parse(readFileSync(installLogPath(projectDir), "utf8"));
    raw.spec.clis = undefined;
    raw.templates.claudeDir = ".claude/";
    writeFileSync(installLogPath(projectDir), JSON.stringify(raw, null, 2));

    // 설치자가 Claude Code 를 쓰며 생긴 것 — 하네스는 이 파일들을 만든 적이 없다.
    mkdirSync(join(projectDir, ".claude/commands"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/settings.local.json"), '{"permissions":{}}\n');
    writeFileSync(join(projectDir, ".claude/commands/mine.md"), "# 내 명령\n");
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const runUninstallCli = (cli: string): { code: number | null; errors: string } => {
    const errors: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir, cli },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: () => {},
        err: (l: string) => errors.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return { code, errors: errors.join("\n") };
  };

  it("깔린 집합은 codex 뿐이다 — 디스크의 `.claude/` 는 유도에 들어오지 않는다", () => {
    expect(installedClis(readInstallLog(projectDir))).toEqual(["codex"]);
  });

  it("`uninstall --cli claude` 를 거절한다 — 설치자 파일은 하나도 안 사라진다", () => {
    const before = claudeFiles();

    const run = runUninstallCli("claude");

    expect(run.code).toBe(1);
    expect(run.errors).toContain("not installed");
    expect(claudeFiles()).toEqual(before);
    expect(readFileSync(join(projectDir, ".claude/settings.local.json"), "utf8")).toBe(
      '{"permissions":{}}\n',
    );
    expect(readFileSync(join(projectDir, ".claude/commands/mine.md"), "utf8")).toBe("# 내 명령\n");
  });

  it("`update` 는 `.claude/` 에 파일을 하나도 만들지 않는다 — 고른 적 없는 CLI 다", () => {
    const before = claudeFiles();

    const report = runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);

    expect(claudeFiles()).toEqual(before);
    expect(report.installedNew.filter((p) => p.startsWith(".claude/"))).toEqual([]);
  });

  it("`list` 는 깔리지 않은 CLI 를 말하지 않는다", () => {
    const lines: string[] = [];
    listAction(
      { projectDir },
      {
        log: (l: string) => lines.push(l),
        err: () => {},
        exit: (() => {}) as unknown as (code: number) => never,
      },
    );

    const cliLine = lines.find((l) => l.includes("cli:"));
    expect(cliLine).toContain("codex");
    expect(cliLine).not.toContain("claude");
  });
});
