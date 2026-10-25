import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { hashContent, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { scaffoldBanner } from "../src/project-claude-merge.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #862 — 하네스가 씨뿌린 `AGENTS.md` 의 배너(인용 블록) 바로 아래에 설치자가 자기 메모를 인용 줄로 이어 적고 update 를 거치면,
 * uninstall 이 그 파일을 "하네스 몫만 들었다" 고 읽어 파일째 지웠다 — "채웠는가" 판정이 배너 인용 블록을 통째로 하네스 것으로 봤다.
 */
describe("#862 AGENTS.md 배너에 이어 적은 설치자 인용 줄은 uninstall 뒤에도 남는다", () => {
  let projectDir: string;
  const NOTE = "> MY NOTE — 이 저장소는 결제 팀이 관리한다.";

  const install = (cli: ReadonlyArray<CliBase>, mode?: "update"): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      ...(mode === undefined ? {} : { mode }),
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [...cli],
        projectDir,
      } satisfies InstallSpec,
    });
  };

  const agentsPath = (): string => join(projectDir, "AGENTS.md");
  const agents = (): string => readFileSync(agentsPath(), "utf8");

  const uninstall = (cli?: string): string => {
    const lines: string[] = [];
    let code: number | null = null;
    uninstallAction(
      { projectDir, ...(cli === undefined ? { yes: true } : { cli }) },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    expect(code).toBe(0);
    return lines.join("\n");
  };

  /** 배너 셋째 줄 바로 아래(같은 인용 블록)에 설치자 줄을 붙이고 update — 기록 sha 가 그 줄을 담은 디스크와 같아진다. */
  const appendNoteThenUpdate = (): void => {
    const banner = scaffoldBanner("agents-md");
    const text = agents();
    expect(text, "픽스처 자기검증 — 씨뿌린 배너가 있다").toContain(banner);
    writeFileSync(agentsPath(), text.replace(banner, `${banner}\n${NOTE}`));
    install(["claude"], "update");
    expect(agents(), "update 가 설치자 줄을 살렸다").toContain(`${banner}\n${NOTE}`);
    const rec = readInstallLog(projectDir)?.externalFiles?.find((f) => f.path === "AGENTS.md");
    // 결함이 생기는 조건 — 기록 sha 가 디스크와 같아야 uninstall 이 "하네스가 만든 파일" 걷기에 들어간다
    expect(rec?.sha256, "기록 sha = 디스크").toBe(hashContent(agents()));
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un862-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  for (const cli of [undefined, "codex"]) {
    const path = cli === undefined ? "전체 uninstall" : `uninstall --cli ${cli}`;

    it(`${path} — 파일이 남고 설치자 줄은 그대로, 하네스 배너 줄은 걷힌다`, () => {
      install(["claude", "codex"]);
      appendNoteThenUpdate();

      const text = uninstall(cli);

      expect(existsSync(agentsPath()), "파일이 남는다").toBe(true);
      const after = agents();
      expect(after).toContain(NOTE);
      for (const line of scaffoldBanner("agents-md").split("\n")) expect(after).not.toContain(line);
      expect(text).not.toContain("AGENTS.md — removed");
    });

    it(`대조군: ${path} · 손대지 않은 씨뿌린 AGENTS.md 는 지금처럼 파일째 회수한다`, () => {
      install(["claude", "codex"]);
      install(["claude"], "update");

      uninstall(cli);

      expect(existsSync(agentsPath())).toBe(false);
    });
  }
});
