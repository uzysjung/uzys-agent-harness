import {
  existsSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { installedClis, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #528 — `uninstall --cli <name>` (Epic #527 정의 4).
 *
 * 판정 기준 한 문장: **claude+codex 로 깐 프로젝트에서 `uninstall --cli codex` 를 치면 codex
 * 전용 파일과 (codex 가 마지막 사용자인) 공유 파일만 사라지고 `.claude/` · 설치자 본문 ·
 * 로그의 claude 기록은 그대로다.**
 *
 * 공유 자리가 이 명령의 핵심이다: `AGENTS.md` 는 codex·opencode 가, `.agents/skills/` 는
 * codex·opencode·antigravity 가 나눠 쓴다. 남는 CLI 중 쓰는 쪽이 있으면 남겨야 하고, 없을
 * 때만 회수한다 — 그 판정은 `cli-ownership.ts` 의 표 하나에서 나온다.
 */
describe("#528 uninstall --cli", () => {
  let projectDir: string;

  const install = (cli: ReadonlyArray<CliBase>): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [...cli],
        projectDir,
      } satisfies InstallSpec,
    });
  };

  interface RunResult {
    lines: string[];
    errors: string[];
    code: number | null;
  }

  const removeCli = (
    cli: string,
    extra: { dryRun?: boolean; only?: string; keepTemplates?: boolean } = {},
  ): RunResult => {
    const out: RunResult = { lines: [], errors: [], code: null };
    uninstallAction(
      { projectDir, cli, ...extra },
      {
        exit: (code: number) => {
          out.code ??= code;
          return undefined as never;
        },
        log: (l: string) => out.lines.push(l),
        err: (l: string) => out.errors.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return out;
  };

  const has = (rel: string): boolean => existsSync(join(projectDir, rel));

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un528-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("claude+codex 에서 codex 만 뺀다 — codex 전용 + 마지막 사용자가 된 공유 자리", () => {
    install(["claude", "codex"]);
    // 시나리오 자기검증 — 회수 대상이 실제로 깔려 있어야 판정이 의미가 있다.
    expect(has(".codex")).toBe(true);
    expect(has("AGENTS.md")).toBe(true);
    expect(has(".agents/skills")).toBe(true);

    const run = removeCli("codex");

    expect(run.code).toBe(0);
    expect(has(".codex")).toBe(false);
    expect(has("AGENTS.md")).toBe(false); // codex 가 마지막 사용자였다
    expect(has(".agents/skills")).toBe(false);
    // claude 쪽은 하나도 안 건드린다.
    expect(has(".claude")).toBe(true);
    expect(has("CLAUDE-uzys-harness.md")).toBe(true);
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).toContain("uzys-harness:import");

    const log = readInstallLog(projectDir);
    expect(log?.spec.clis).toEqual(["claude"]);
    expect(log?.templates.codexDir).toBeUndefined();
    expect(log?.templates.claudeDir).toBe(".claude/");
    expect((log?.externalFiles ?? []).some((f) => f.path === "AGENTS.md")).toBe(false);
  });

  it("뺀 CLI 의 흔적은 기록에서 사라진다 — 회수한 디렉터리의 `externalFiles` · 깔린 집합(`clis`)", () => {
    // 남겨 두면 기록이 디스크와 다른 말을 한다(리뷰 N2). 단 `spec.cli` 는 "마지막 install 의
    // 요청"이라 손대지 않는다 — 비우면 빈 배열이 되고 외부 스킬 refresh 가 `--agent`·`--copy` 를
    // 못 붙여 Claude 몫이 조용히 빠진다(재리뷰 BLOCKER-3). 깔린 집합은 `clis` 하나가 말한다.
    install(["claude", "codex"]);
    const before = readInstallLog(projectDir);
    expect(before?.spec.cli).toEqual(["claude", "codex"]);
    expect((before?.externalFiles ?? []).some((f) => f.path.startsWith(".codex/"))).toBe(true);

    expect(removeCli("codex").code).toBe(0);

    const log = readInstallLog(projectDir);
    expect(log?.spec.cli).toEqual(["claude", "codex"]); // 마지막 요청은 그대로
    expect(installedClis(log)).toEqual(["claude"]); // 깔린 집합은 갱신
    expect((log?.externalFiles ?? []).some((f) => f.path.startsWith(".codex/"))).toBe(false);
  });

  it("opencode 가 남으면 공유 자리는 남는다 — `AGENTS.md` · `.agents/skills/`", () => {
    install(["claude", "codex", "opencode"]);

    const run = removeCli("codex");

    expect(run.code).toBe(0);
    expect(has(".codex")).toBe(false); // codex 전용
    expect(has("AGENTS.md")).toBe(true); // opencode 가 아직 쓴다
    expect(has(".agents/skills")).toBe(true);
    expect(has("opencode.json")).toBe(true);
    expect(readInstallLog(projectDir)?.spec.clis).toEqual(["claude", "opencode"]);
  });

  it("마지막 사용자가 나가면 채운 `AGENTS.md` 는 하네스 절만 걷어낸다 (#516 규칙 승계)", () => {
    install(["claude", "codex"]);
    const agentsPath = join(projectDir, "AGENTS.md");
    const filled = readFileSync(agentsPath, "utf8").replace(
      "## Project Context\n",
      "## Project Context\n\n이 프로젝트는 결제 정산 배치다.\n",
    );
    writeFileSync(agentsPath, filled);
    // 설치자가 고친 뒤 update 가 그 문장을 이어받아 다시 쓴 상태를 만든다 — 그래야 기준선
    // sha 안에 설치자 문장이 들어가고, #516 이 고친 바로 그 조건이 된다.
    install(["claude", "codex"]);
    expect(readFileSync(agentsPath, "utf8")).toContain("결제 정산 배치");

    const run = removeCli("codex");

    expect(run.code).toBe(0);
    const remainder = readFileSync(agentsPath, "utf8");
    expect(remainder).toContain("결제 정산 배치");
    expect(remainder).not.toContain("## Harness Rules");
  });

  it("claude 를 빼면 `.claude/` 와 앵커는 가고 루트 `CLAUDE.md` 는 본문만 남는다", () => {
    install(["claude", "codex"]);
    const rootMd = join(projectDir, "CLAUDE.md");
    writeFileSync(rootMd, `# My Project\n\n내가 쓴 줄이다.\n\n${readFileSync(rootMd, "utf8")}`);

    const run = removeCli("claude");

    expect(run.code).toBe(0);
    expect(has(".claude")).toBe(false);
    expect(has("CLAUDE-uzys-harness.md")).toBe(false);
    const remainder = readFileSync(rootMd, "utf8");
    expect(remainder).toContain("내가 쓴 줄이다.");
    expect(remainder).not.toContain("uzys-harness:import");
    // codex 는 그대로다.
    expect(has(".codex")).toBe(true);
    expect(has("AGENTS.md")).toBe(true);
    expect(readInstallLog(projectDir)?.spec.clis).toEqual(["codex"]);
    expect(readInstallLog(projectDir)?.templates.claudeDir).toBeUndefined();
  });

  it("마지막 CLI 는 거절한다 — 전량 삭제 경로를 두 개 두지 않는다", () => {
    install(["claude"]);

    const run = removeCli("claude");

    expect(run.code).toBe(1);
    expect(run.errors.join("\n")).toContain("마지막 CLI");
    expect(has(".claude")).toBe(true);
    expect(readInstallLog(projectDir)).not.toBeNull();
  });

  it("안 깔린 CLI 는 거절하고 깔린 목록을 알려 준다", () => {
    install(["claude"]);

    const run = removeCli("codex");

    expect(run.code).toBe(1);
    expect(run.errors.join("\n")).toContain("not installed");
    expect(run.errors.join("\n")).toContain("claude");
  });

  it("CLI 이름이 아니면 거절한다", () => {
    install(["claude", "codex"]);

    const run = removeCli("cursor");

    expect(run.code).toBe(1);
    expect(run.errors.join("\n")).toContain("Invalid --cli value");
    expect(has(".codex")).toBe(true);
  });

  it("`--only` · `--keep-templates` 와는 조합할 수 없다", () => {
    install(["claude", "codex"]);

    expect(removeCli("codex", { only: "openspec" }).code).toBe(1);
    expect(removeCli("codex", { keepTemplates: true }).code).toBe(1);
    expect(has(".codex")).toBe(true);
  });

  it("`--dry-run` 은 아무것도 바꾸지 않고 같은 술어로 예고한다", () => {
    install(["claude", "codex"]);
    const logBefore = readFileSync(
      join(projectDir, ".uzys-agent-harness/.harness-install.json"),
      "utf8",
    );

    const run = removeCli("codex", { dryRun: true });

    expect(run.code).toBe(0);
    expect(run.lines.join("\n")).toContain("remove .codex/");
    expect(has(".codex")).toBe(true);
    expect(has("AGENTS.md")).toBe(true);
    expect(
      readFileSync(join(projectDir, ".uzys-agent-harness/.harness-install.json"), "utf8"),
    ).toBe(logBefore);
  });

  it("심링크는 예고와 실행이 같은 술어로 건너뛴다 — `npx skills` 가 깐 포인터다", () => {
    install(["claude", "codex"]);
    // `npx skills add` 가 파일을 심링크로 깔아 둔 상태. 내용이 그대로라 sha 판정만으로는
    // 회수 대상으로 보이지만, 그 링크는 우리가 만든 것이 아니다. 실행 경로는 `lstatSync` 로
    // 걸러 내는데 예고에 그 줄이 없으면 "remove N file(s)" 가 실제와 갈린다(리뷰 N5).
    const recorded = (readInstallLog(projectDir)?.externalFiles ?? []).find((f) =>
      f.path.startsWith(".agents/skills/"),
    )?.path;
    expect(recorded).toBeDefined();
    const linked = join(projectDir, recorded as string);
    const real = `${linked}.real`;
    renameSync(linked, real);
    symlinkSync(real, linked);

    const preview = removeCli("codex", { dryRun: true });
    const run = removeCli("codex");

    const previewed = /remove (\d+) CLI output file/.exec(preview.lines.join("\n"))?.[1];
    const removed = /CLI outputs removed: (\d+) file/.exec(run.lines.join("\n"))?.[1];
    expect(previewed).toBeDefined();
    expect(previewed).toBe(removed);
    // 링크 자체는 양쪽 다 건드리지 않는다.
    expect(existsSync(linked)).toBe(true);
  });

  it("옛 로그(`clis` 없음)에서도 유도한 집합으로 판정한다", () => {
    install(["claude", "codex"]);
    const logPath = join(projectDir, ".uzys-agent-harness/.harness-install.json");
    const raw = JSON.parse(readFileSync(logPath, "utf8"));
    // v26.160.1 이하가 남기던 모양 — `clis` 가 없고 `spec.cli` 는 마지막 설치분뿐이다.
    raw.spec.clis = undefined;
    raw.spec.cli = ["codex"];
    writeFileSync(logPath, JSON.stringify(raw, null, 2));
    expect(installedClis(readInstallLog(projectDir))).toEqual(["claude", "codex"]);

    const run = removeCli("codex");

    expect(run.code).toBe(0);
    expect(has(".claude")).toBe(true);
    expect(readInstallLog(projectDir)?.spec.clis).toEqual(["claude"]);
  });
});
