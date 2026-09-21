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
    // 재리뷰 BLOCKER-6 — 건너뛰되 침묵하지 않는다. 앵커 기록이 지워진 옛 claude 설치본(v26.125.0
    // 이전 add)이 같은 모양이라 화면이 사실과 복구 명령을 내야 한다.
    // 복구 명령은 로그의 트랙·scope 로 채워져 그대로 칠 수 있어야 한다(6차 NOTE-I·J).
    expect(report.claudeUnrecorded).toBe(
      "agent-harness install --track tooling --cli claude --scope project",
    );
  });

  it("설치자의 `.claude/rules/…` 가 템플릿과 같은 경로여도 `update` 는 덮지도 기록하지도 깔지도 않는다 (재리뷰 BLOCKER-4)", () => {
    // 3차 리뷰 실측: 이 파일 하나로 정책 동기화가 돌아 `policyFiles` 를 기록하고, 같은 실행의 뒤
    // 단계가 그 기록으로 claude 를 유도해 스킬 11종과 앵커까지 깔았다 → `--cli claude` 가 설치자
    // 파일을 함께 지우는 1차 BLOCKER-1 모양으로 돌아간다.
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "# 내 룰\n");
    const before = claudeFiles();

    const report = runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);

    expect(claudeFiles()).toEqual(before);
    expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe("# 내 룰\n");
    expect(report.updated[".claude/rules"] ?? 0).toBe(0);
    expect(report.installedNew.filter((p) => p.startsWith(".claude/"))).toEqual([]);
    expect(report.anchorCreated).toBe(false);
    const log = readInstallLog(projectDir);
    expect(log?.policyFiles).toBeUndefined();
    expect(log?.skillFiles).toBeUndefined();
    expect(log?.templates.rootClaudeMd).toBeUndefined();
    expect(installedClis(log)).toEqual(["codex"]);
  });

  it("옛 판이 남긴 `policyFiles`(설치자 룰이 섞인 기준선)가 있어도 claude 로 승격되지 않는다 (재리뷰 BLOCKER-5)", () => {
    // 배포판 v26.160.1 까지는 `.claude/` 를 무조건 훑어 기준선을 찍었다. 실제 설치자의 옛 로그는
    // 그래서 `pf ≥ 1` 이다 — 그 모양에서 update 한 번에 스킬 11종·앵커가 깔리고 `--cli claude` 가
    // 설치자 파일을 함께 지우는 경로가 열렸다(4차 리뷰 컨테이너 실측).
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "# 내 룰\n");
    const raw = JSON.parse(readFileSync(installLogPath(projectDir), "utf8"));
    raw.policyFiles = [{ path: "rules/git-policy.md", sha256: "deadbeef" }];
    raw.skillFiles = [{ path: "north-star/SKILL.md", sha256: "deadbeef" }];
    writeFileSync(installLogPath(projectDir), JSON.stringify(raw, null, 2));
    expect(installedClis(readInstallLog(projectDir))).toEqual(["codex"]);
    const before = claudeFiles();

    const report = runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);

    expect(claudeFiles()).toEqual(before);
    expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe("# 내 룰\n");
    expect(report.installedNew.filter((p) => p.startsWith(".claude/"))).toEqual([]);
    expect(report.anchorCreated).toBe(false);
    expect(readInstallLog(projectDir)?.templates.rootClaudeMd).toBeUndefined();
    expect(runUninstallCli("claude").code).toBe(1);
    expect(claudeFiles()).toEqual(before);
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

/**
 * #528 재리뷰 N-A — **`.claude/` 기준선(`policyFiles` · `skillFiles`)은 claude 가 깔린 집합에 있을 때만
 * 찍는다.** 안 고른 설치본의 `.claude/` 는 설치자 것인데, 템플릿과 같은 상대 경로(`rules/git-policy.md`)
 * 가 우연히 있으면 기록이 생겨 옛 로그 유도가 claude 를 "깔렸다"고 읽는다 — 그 한 줄이 위 describe 의
 * 삭제 경로로 이어진다. 기록 시점에서 막는다.
 */
describe("#528 codex 단독 설치는 설치자 `.claude/` 를 훑어 기준선을 찍지 않는다", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "legacy528b-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const install = (cli: InstallSpec["cli"]) =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir },
    });

  it("템플릿과 같은 경로의 설치자 룰이 있어도 policyFiles·skillFiles 가 안 생기고 claude 로 유도되지 않는다", () => {
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "# 내 룰\n");
    mkdirSync(join(projectDir, ".claude/skills/north-star"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/skills/north-star/SKILL.md"), "# 내 스킬\n");

    install(["codex"]);

    const log = readInstallLog(projectDir);
    expect(log?.policyFiles).toBeUndefined();
    expect(log?.skillFiles).toBeUndefined();
    expect(installedClis(log)).toEqual(["codex"]);
    // 옛 판 형태(clis 없음)로 되돌려도 같은 답 — 유도가 기록만 읽는다.
    const raw = JSON.parse(readFileSync(installLogPath(projectDir), "utf8"));
    raw.spec.clis = undefined;
    expect(installedClis(raw)).toEqual(["codex"]);
    // 설치자 파일은 그대로다.
    expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe("# 내 룰\n");
  });

  it("대조군 — claude 를 고르면 기준선이 찍힌다 (게이트가 반대로 작동하지 않는다)", () => {
    install(["claude"]);
    const log = readInstallLog(projectDir);
    expect(log?.policyFiles?.length ?? 0).toBeGreaterThan(0);
    expect(log?.skillFiles?.length ?? 0).toBeGreaterThan(0);
    // 기록된 claude 설치본에는 BLOCKER-6 안내가 뜨지 않는다.
    expect(runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT).claudeUnrecorded).toBeNull();
  });

  it("claude 로 깔고 codex 를 추가해도 `.claude/` 기준선은 계속 찍힌다 (ADR-047 판정 불가 회귀 방지)", () => {
    install(["claude"]);
    install(["codex"]);
    const log = readInstallLog(projectDir);
    expect(installedClis(log)).toEqual(["claude", "codex"]);
    expect(log?.policyFiles?.length ?? 0).toBeGreaterThan(0);
  });
});
