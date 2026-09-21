import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import {
  expectedSkillRelFiles,
  installedSkillIdWithReferences,
} from "./helpers/bundled-skill-dir.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #350 — **uninstall 후에도 `.agents/` 가 통째로 남았다.**
 *
 * 회수 목록(`log.templates`)이 `.claude/`·`.codex/`·`.opencode/` 세 디렉터리만 알고 있어서,
 * codex·opencode·antigravity 가 공유하는 `.agents/` 는 대상이 아니었다. 실측(2026-08-29 ·
 * v26.148.1): codex 설치 후 uninstall 하면 `.agents/skills/` 7종이, antigravity 면
 * `.agents/rules/` 6종까지 남고 **화면에는 한 줄도 안 뜬다**.
 *
 * `.agents/` 를 회수 목록에 더하는 것은 답이 아니다 — 그 자리는 `npx skills` 와 공유하고,
 * 그쪽은 `.claude/skills/<id>` 를 `.agents/` 로의 심링크로 만들어 **본문을 거기 둔다**
 * (`external-installer.ts` 실측 주석). 통째 삭제는 남의 도구가 깐 스킬 본문을 지운다.
 *
 * 그래서 **우리가 쓴 파일만** 지운다 — `externalFiles`(ADR-048)에 경로와 sha256 이 이미 있다.
 */
describe("#350 uninstall 이 .agents/ 산출물을 회수한다", () => {
  let projectDir: string;

  const install = (cli: CliBase) =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [cli],
        projectDir,
      } satisfies InstallSpec,
    });

  const uninstall = (): string[] => {
    const lines: string[] = [];
    uninstallAction(
      { projectDir, yes: true, dryRun: false },
      {
        exit: () => undefined as never,
        log: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return lines;
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un350-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  for (const cli of ["codex", "antigravity"] as const) {
    it(`cli=${cli}: 설치가 만든 .agents/ 가 uninstall 후 남지 않는다`, () => {
      install(cli);
      // 시나리오 자기검증 — 설치가 실제로 `.agents/` 를 만들었어야 이 판정이 의미가 있다.
      expect(existsSync(join(projectDir, ".agents"))).toBe(true);

      const lines = uninstall();

      expect(existsSync(join(projectDir, ".agents"))).toBe(false);
      expect(lines.join("\n")).toContain("CLI outputs removed");
    });
  }

  /**
   * #431 — 스킬이 디렉터리로 나가면서 회수 대상도 `SKILL.md` 하나가 아니게 됐다.
   *
   * 회수는 `externalFiles` 기록으로 한다(위 주석). 형제 파일이 그 기록에서 빠지면 `.agents/`
   * 안에 우리 파일이 남고, 사용자 화면에는 한 줄도 안 뜬다 — #350 과 똑같은 형태다.
   */
  it("스킬 디렉터리의 형제 파일까지 회수된다 (#431)", () => {
    install("codex");
    const id = installedSkillIdWithReferences(HARNESS_ROOT, join(projectDir, ".agents/skills"));
    const siblings = expectedSkillRelFiles(HARNESS_ROOT, id).filter((rel) => rel !== "SKILL.md");
    // 시나리오 자기검증 — 형제가 안 깔렸으면 아래 부재 단언은 아무것도 재지 않는다.
    expect(siblings.length, `${id} 의 형제 파일이 0건 — 유도기가 틀렸다`).toBeGreaterThan(0);
    for (const rel of siblings) {
      expect(existsSync(join(projectDir, ".agents/skills", id, rel)), `설치 ${rel}`).toBe(true);
    }
    const recorded = (readInstallLog(projectDir)?.externalFiles ?? []).map((f) => f.path);
    for (const rel of siblings) {
      expect(recorded, "기록에 없으면 회수도 안 된다").toContain(`.agents/skills/${id}/${rel}`);
    }

    uninstall();

    for (const rel of siblings) {
      expect(existsSync(join(projectDir, ".agents/skills", id, rel)), `잔존 ${rel}`).toBe(false);
    }
  });

  it("사용자가 고친 산출물은 남기고 그 사실을 화면에 낸다", () => {
    install("antigravity");
    const edited = join(projectDir, ".agents/rules/git-policy.md");
    expect(existsSync(edited)).toBe(true);
    writeFileSync(edited, "# 내가 고친 룰\n");

    const lines = uninstall();

    expect(readFileSync(edited, "utf-8")).toBe("# 내가 고친 룰\n");
    expect(lines.join("\n")).toContain(".agents/rules/git-policy.md kept");
  });

  it("우리가 안 쓴 파일은 지우지 않는다 — `.agents/` 는 npx skills 와 공유한다", () => {
    install("codex");
    // 다른 도구가 같은 트리에 깔아 둔 스킬. 우리 기록에 없으므로 우리 것이 아니다.
    const foreign = join(projectDir, ".agents/skills/someone-elses/SKILL.md");
    mkdirSync(join(projectDir, ".agents/skills/someone-elses"), { recursive: true });
    writeFileSync(foreign, "# 남의 스킬\n");

    uninstall();

    expect(readFileSync(foreign, "utf-8")).toBe("# 남의 스킬\n");
    // 우리 것은 그래도 다 나갔다 — 남의 파일 하나가 회수를 통째로 막지 않는다.
    expect(existsSync(join(projectDir, ".agents/skills/north-star"))).toBe(false);
  });

  it("남의 도구가 링크로 깔아 둔 자리는 건드리지도, 언급하지도 않는다", () => {
    install("codex");
    // `npx skills add` 가 이 모양으로 깐다 (#343 실사용자 신고로 관측된 상태).
    const target = join(projectDir, "elsewhere-SKILL.md");
    const slot = join(projectDir, ".agents/skills/north-star/SKILL.md");
    const ours = readFileSync(slot, "utf-8");
    // 내용까지 같게 만들어, 해시가 우연히 일치해도 안 지우는지 본다.
    writeFileSync(target, ours);
    rmSync(slot);
    symlinkSync(target, slot);

    const lines = uninstall();

    expect(lstatSync(slot).isSymbolicLink()).toBe(true);
    expect(readFileSync(target, "utf-8")).toBe(ours);
    expect(lines.join("\n")).not.toContain("north-star/SKILL.md kept");
  });

  it("claude 만 고른 설치는 이 경로에 아무 말도 하지 않는다 (오탐 대조군)", () => {
    install("claude");

    const lines = uninstall();

    expect(lines.join("\n")).not.toContain("CLI outputs removed");
    expect(lines.join("\n")).not.toContain("kept — modified since install");
  });

  it("dry-run 이 실행과 같은 것을 예고한다", () => {
    install("antigravity");
    const preview: string[] = [];
    uninstallAction(
      { projectDir, yes: true, dryRun: true },
      { exit: () => undefined as never, log: (l: string) => preview.push(l) },
    );

    expect(preview.join("\n")).toMatch(/remove \d+ CLI output file\(s\)/);
    // 미리보기는 아무것도 안 바꾼다.
    expect(existsSync(join(projectDir, ".agents"))).toBe(true);
  });
});

/**
 * #516 — **uninstall 이 설치자가 채운 `AGENTS.md` 를 통째로 지웠다.**
 *
 * `update` 가 설치자 절을 이어받아 다시 쓰면서(#503) 그 문장이 기준선 sha 안으로 들어갔고,
 * uninstall 은 "기준선과 같은 파일 = 우리 것"으로 보고 지웠다. 직전 백업에는 남지만 살아 있는
 * 파일은 없다. 루트 `CLAUDE.md` 는 import 블록만 걷어내고 본문을 남기는 것과 비대칭이었다.
 *
 * 여기서 무는 것은 설치자가 실제로 치는 순서 그대로다 — install → 절을 채움 → update → uninstall.
 */
describe("#516 uninstall 이 AGENTS.md 의 하네스 절만 걷어내고 설치자 절을 남긴다", () => {
  let projectDir: string;

  const run = (mode: "add" | "update") =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      mode,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: mode === "update" ? ["claude"] : ["codex"],
        projectDir,
      } satisfies InstallSpec,
    });

  const uninstall = (dryRun = false): string[] => {
    const lines: string[] = [];
    uninstallAction(
      { projectDir, yes: true, dryRun },
      {
        exit: () => undefined as never,
        log: (l: string) => lines.push(l),
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    return lines;
  };

  const agentsPath = () => join(projectDir, "AGENTS.md");
  const read = () => readFileSync(agentsPath(), "utf8");

  /** 설치자가 두 절을 채운다 — 맥락 문단 하나, 규칙 줄 하나. */
  const CONTEXT_LINE = "우리 팀 결제 서비스다. 런타임은 Bun.";
  const RULE_LINE = "- PR 은 두 명이 본다.";
  const fill = (): void => {
    const filled = read()
      .replace("## Project Context\n", `## Project Context\n\n${CONTEXT_LINE}\n`)
      .replace("\n## Harness Rules", `\n${RULE_LINE}\n\n## Harness Rules`);
    expect(filled, "대조군 — 채우기가 실제로 들어갔어야 아래 판정이 의미가 있다").toContain(
      RULE_LINE,
    );
    writeFileSync(agentsPath(), filled);
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "un516-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("채운 AGENTS.md → update → uninstall: 파일이 남고 설치자 절은 그대로, 하네스 절·마커는 없다", () => {
    run("add");
    fill();
    run("update");
    // 시나리오 자기검증 — update 가 설치자 문장을 기준선 안으로 들였는지(= #516 이 생기는 조건).
    expect(read()).toContain(CONTEXT_LINE);
    expect(read()).toContain("## Harness Rules");

    const lines = uninstall();

    expect(existsSync(agentsPath())).toBe(true);
    const after = read();
    expect(after).toContain(CONTEXT_LINE);
    expect(after).toContain(RULE_LINE);
    expect(after).toContain("## Project Context");
    expect(after).toContain("## Project Rules");
    // 하네스 몫은 전부 나갔다 — 절도, 마커도, 앵커 본문도.
    expect(after).not.toContain("## Harness Rules");
    expect(after).not.toContain("## Session Start");
    expect(after).not.toContain("## Protected Files");
    expect(after).not.toContain("<!-- uzys-harness:");
    expect(after).not.toContain("Skills that apply continuously");
    expect(lines.join("\n")).toContain("AGENTS.md — harness sections removed");
  });

  it("아무것도 안 채운 AGENTS.md 는 전과 같이 지운다 — 남길 설치자 절이 없다", () => {
    run("add");
    run("update");

    uninstall();

    expect(existsSync(agentsPath())).toBe(false);
  });

  it("--dry-run 은 '걷어낸다'고 미리 말하고 파일은 건드리지 않는다", () => {
    run("add");
    fill();
    run("update");
    const before = read();

    const lines = uninstall(true);

    expect(lines.join("\n")).toContain("strip harness sections from AGENTS.md");
    expect(read()).toBe(before);
  });
});
