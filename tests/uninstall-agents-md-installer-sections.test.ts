import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { hashContent, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #736 — `AGENTS.md` 에 자기 절을 덧붙인 설치자가 **어떤 uninstall 경로를 거쳐도** 그 글을 잃지 않는다.
 *
 * 결함이 생기는 순서 그대로다: install → 하네스 절 자리(파일 끝 · `## Session Start` 앞)에 `## Team rules` → update
 * (설치자 절을 살린 채 다시 써서 기록 sha = 디스크) → 마지막 비-Claude CLI 를 빼거나 전체 uninstall. 고치기 전에는
 * Project Context 를 안 채웠으면 파일째 지워지고, 채웠으면 그 절만 빠졌다(둘 다 update 백업에만 남는다).
 */
describe("#736 uninstall 은 AGENTS.md 에 설치자가 덧붙인 절을 남긴다", () => {
  let projectDir: string;

  const TEAM = "## Team rules\n\nTEAM-RULES-TEXT — 리뷰는 두 명이 본다.";
  const CONTEXT_LINE = "CONTEXT-LINE — 우리 팀 결제 서비스다.";

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

  const uninstall = (cli?: string): string[] => {
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
    if (cli !== undefined) expect(code).toBe(0);
    return lines;
  };

  /** 설치자 편집 → update. update 가 그 글을 살린 채 기록을 디스크에 맞췄는지까지 자기검증한다. */
  const editThenUpdate = (opts: {
    team: "end" | "beforeSessionStart" | null;
    fillContext: boolean;
  }): void => {
    let text = agents();
    if (opts.fillContext) {
      text = text.replace("## Project Context\n", `## Project Context\n\n${CONTEXT_LINE}\n`);
      expect(text, "픽스처 자기검증 — 맥락 줄이 들어갔다").toContain(CONTEXT_LINE);
    }
    if (opts.team === "end") text = `${text.replace(/\n+$/, "\n")}\n${TEAM}\n`;
    if (opts.team === "beforeSessionStart") {
      expect(text, "픽스처 자기검증 — 끼울 자리가 있다").toContain("\n## Session Start\n");
      text = text.replace("\n## Session Start\n", `\n${TEAM}\n\n## Session Start\n`);
    }
    writeFileSync(agentsPath(), text);
    install(["claude"], "update");
    if (opts.team !== null) expect(agents(), "update 가 설치자 절을 살렸다").toContain(TEAM);
    const rec = readInstallLog(projectDir)?.externalFiles?.find((f) => f.path === "AGENTS.md");
    // 결함이 생기는 조건 — 기록 sha 가 디스크와 같아야 uninstall 이 "하네스 것" 으로 걷기에 들어간다.
    expect(rec?.sha256, "기록 sha = 디스크").toBe(hashContent(agents()));
  };

  /** 하네스 몫이 하나도 안 남았다 — 절도 룰 제목도 마커도. */
  const expectNoHarness = (after: string): void => {
    for (const harness of [
      "## Harness Rules",
      "## Session Start",
      "## Protected Files",
      "## Git Safety",
      "<!-- uzys-harness:",
    ]) {
      expect(after, harness).not.toContain(harness);
    }
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un736-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const cases = [
    { path: "uninstall --cli codex", cli: "codex" as const },
    { path: "전체 uninstall", cli: undefined },
  ];
  for (const { path, cli } of cases) {
    for (const team of ["end", "beforeSessionStart"] as const) {
      for (const fillContext of [false, true]) {
        it(`${path} · ## Team rules 위치=${team} · Project Context ${fillContext ? "채움" : "안 채움"} → 그 절이 남는다`, () => {
          install(["claude", "codex"]);
          editThenUpdate({ team, fillContext });

          const lines = uninstall(cli);

          expect(existsSync(agentsPath()), "파일이 남는다").toBe(true);
          const after = agents();
          expect(after).toContain(TEAM);
          if (fillContext) expect(after).toContain(CONTEXT_LINE);
          else
            expect(after, "안 채운 스캐폴드는 하네스 글이다").not.toContain("## Project Context");
          expectNoHarness(after);
          // 화면은 실제로 한 일을 말한다 — 지웠다가 아니라 하네스 절만 걷었다.
          expect(lines.join("\n")).toContain("AGENTS.md — harness sections removed");
        });
      }
    }
  }

  it("claude+antigravity 에서 uninstall --cli antigravity → 끝에 붙인 절이 남는다", () => {
    install(["claude", "antigravity"]);
    editThenUpdate({ team: "end", fillContext: false });

    uninstall("antigravity");

    expect(existsSync(agentsPath())).toBe(true);
    expect(agents()).toContain(TEAM);
    expectNoHarness(agents());
  });

  // 대조군 — 설치자 몫이 하나도 없으면(같은 update 경로를 거쳐도) 파일째 지운다. 하네스 룰 제목을 설치자 절로 세지 않는다.
  for (const { path, cli } of cases) {
    it(`대조군: ${path} · 설치자 몫 없음 → 파일째 지운다`, () => {
      install(["claude", "codex"]);
      expect(agents(), "대조군 자기검증 — 하네스 룰 제목이 있다").toContain("## Git Safety");
      editThenUpdate({ team: null, fillContext: false });

      uninstall(cli);

      expect(existsSync(agentsPath())).toBe(false);
    });
  }
});
