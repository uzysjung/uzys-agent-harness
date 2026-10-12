import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANCHOR_BLOCK,
  mergeAgentsMd,
  stripHarnessFromAgentsMd,
  wrapHarnessBlock,
} from "../src/agents-md-merge.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import { ruleHeadings } from "../src/rules-port.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATE = readFileSync(join(HARNESS_ROOT, "templates/AGENTS.md.template"), "utf8");

/**
 * #739 — `AGENTS.md` 의 "이 절이 설치자 것인가" 를 update 의 병합과 uninstall 의 걷기가 한 판정(`headingOwner`)으로 쓴다.
 * 병합이 따로 쓰던 부분 문자열 대조(`rendered.includes`)가 없어지며 바뀐 update 결과 ①②③ 의 회귀도 여기(③ 은
 * `antigravity-anchor-retire.test.ts` — 26.164.0 픽스처가 거기 있다).
 */
describe("#739 병합과 걷기가 같은 절을 설치자 것으로 본다", () => {
  it("설치자 절 셋(Harness Rules 안 · Session Start 뒤 · 파일 끝) — update 가 되살리는 절 = uninstall 이 남기는 절", () => {
    const rules = ruleHeadings(HARNESS_ROOT);
    expect(rules.has("## Testing"), "픽스처 자기검증 — 실제 배포 룰 제목").toBe(true);
    const doc = (
      harnessRules: string,
      sessionStart: string,
      tail: string,
      anchorHeading = "## 1. Principle",
    ): string =>
      [
        "# P — Agent Guide (Codex)",
        "",
        "## Project Context",
        "",
        renderFillScaffold("agents-md"),
        "",
        "## Project Rules",
        "",
        wrapHarnessBlock(ANCHOR_BLOCK, `# Working Principles\n\n${anchorHeading}\n\nbody`),
        "",
        "## Harness Rules",
        "",
        harnessRules,
        "",
        "## Session Start",
        "",
        sessionStart,
        "",
        "## Protected Files",
        "",
        "- lock 파일은 손으로 고치지 않는다.",
        tail,
      ].join("\n");
    const rendered = doc("## Testing\n\nrule body", "start here", "");
    const existing = doc(
      "## Testing\n\nrule body\n\n## Test\n\nTEST-TEXT",
      "start here\n\n## Release notes\n\nRELEASE-TEXT",
      "\n## Git\n\nGIT-TEXT\n",
      // 옛 판 앵커 제목(본문 절 안) — 두 경로 모두 본문 소유 규칙에 맡겨야 한다. 병합 호출부가 절(region)을 잘못 넘기면
      // 이 제목을 설치자 절로 되살려 걷기와 갈린다(리뷰 NOTE-2)
      "## 1. Old principle",
    );
    const headings = (text: string): string[] => text.split("\n").filter((l) => /^## /.test(l));

    const merged = mergeAgentsMd({
      rendered,
      existing,
      template: TEMPLATE,
      harnessRuleHeadings: rules,
    });
    expect(merged.startsWith(rendered), "픽스처 자기검증 — 설치자 절은 렌더 뒤에 붙는다").toBe(
      true,
    );
    const revived = headings(merged.slice(rendered.length));

    const kept = stripHarnessFromAgentsMd({
      existing,
      template: TEMPLATE,
      harnessRuleHeadings: rules,
    });
    expect(kept).not.toBeNull();
    const left = headings(kept ?? "");

    // `## Test` 는 룰 제목 `## Testing` 의 앞부분이다 — 병합이 부분 문자열로 가르던 때는 여기서 갈렸다
    expect(revived).toEqual(["## Test", "## Release notes", "## Git"]);
    expect(left).toEqual(revived);
  });
});

describe("#739 update 결과 — 부분 문자열 대조를 걷어낸 뒤", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "heading-owner-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const run = (mode?: "update"): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      ...(mode === undefined ? {} : { mode }),
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["codex"] satisfies CliBase[],
        projectDir,
      } satisfies InstallSpec,
    });
  };
  const agentsPath = (): string => join(projectDir, "AGENTS.md");
  const agents = (): string => readFileSync(agentsPath(), "utf8");
  /** 하네스가 이 바이트를 썼다고 기록한다 — 옛 판이 남긴 파일(설치자 편집 아님). */
  const recordAsHarnessWritten = (text: string): void => {
    writeFileSync(agentsPath(), text);
    const log = readInstallLog(projectDir) as InstallLog;
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: (log.externalFiles ?? []).map((f) =>
        f.path === "AGENTS.md" ? { ...f, sha256: hashContent(text) } : f,
      ),
    });
  };

  it("설치자가 적은 `## Test`·`## Git` 절은 하네스 룰 제목(`## Testing`·`## Git Safety`)과 앞부분이 겹쳐도 update 가 지우지 않는다", () => {
    run();
    const before = agents();
    expect(before, "픽스처 자기검증 — 겹치는 룰 제목이 렌더에 있다").toContain("\n## Testing\n");
    expect(before).toContain("\n## Git Safety\n");
    const TEST = "## Test\n\nTEST-TEXT — 통합 테스트는 docker 로만 돈다.";
    const GIT = "## Git\n\nGIT-TEXT — main 에 직접 push 하지 않는다.";
    writeFileSync(
      agentsPath(),
      `${before.replace("\n## Session Start\n", `\n${TEST}\n\n## Session Start\n`).replace(/\n+$/, "\n")}\n${GIT}\n`,
    );

    run("update");
    const after = agents();
    expect(after).toContain(TEST);
    expect(after).toContain(GIT);

    run("update");
    expect(agents()).toBe(after);
  });

  it("마커 없는 옛 판(v26.160.0 이전)의 `## Project Rules` 에 설치자가 적은 `## My rules` 절은 update 뒤에도 파일에 남는다 (ADR-097 결정 4)", () => {
    run();
    const harnessWrote = agents()
      .replace(`${ANCHOR_BLOCK.start}\n`, "")
      .replace(`${ANCHOR_BLOCK.end}\n`, "")
      .replace(/<!-- uzys-harness:skills:(start|end) -->\n/g, "");
    expect(harnessWrote, "픽스처 자기검증 — 마커 없는 옛 판").not.toContain("<!-- uzys-harness:");
    recordAsHarnessWritten(harnessWrote);
    const MINE = "## My rules\n\nMY-RULES-TEXT — 배포는 금요일에 하지 않는다.";
    expect(harnessWrote, "픽스처 자기검증 — 끼울 자리가 있다").toContain("\n## Harness Rules\n");
    writeFileSync(
      agentsPath(),
      harnessWrote.replace("\n## Harness Rules\n", `\n${MINE}\n\n## Harness Rules\n`),
    );

    run("update");
    const after = agents();
    expect(after).toContain(MINE);
    // 되살린 자리는 다른 설치자 절과 같다 — 파일 끝. 앵커 제목은 한 벌만(옛 본문의 하네스 제목은 되살리지 않는다)
    expect(after.trimEnd().endsWith("MY-RULES-TEXT — 배포는 금요일에 하지 않는다.")).toBe(true);
    expect(after.split("\n## 1. Understand what success means\n").length - 1).toBe(1);

    run("update");
    expect(agents()).toBe(after);
  });

  /**
   * v26.151.0·v26.152.0(npm 게시본)이 남긴 마커 없는 `AGENTS.md` — `## Project Rules` 에 그 판의 앵커 본문이 마커 없이 들어 있다.
   * 앵커 본문 = 그 판의 `templates/CLAUDE.md`(첫 h1 제거). 그 바이트를 하네스가 썼다고 기록한다.
   */
  const OLD_ANCHOR_FIRST = "## 1. Resolve what matters, then act";
  const NOW_ANCHOR_FIRST = "## 1. Understand what success means";
  const writeLegacy152 = (): string => {
    run();
    const anchorBody = (md: string): string => md.replace(/^#\s+.*\r?\n/, "").trim();
    const now = anchorBody(readFileSync(join(HARNESS_ROOT, "templates/CLAUDE.md"), "utf8"));
    const old = anchorBody(
      readFileSync(join(HARNESS_ROOT, "tests/fixtures/anchor-v26.152.0.md"), "utf8"),
    );
    const legacy = agents()
      .replace(/<!-- uzys-harness:[a-z]+:(start|end) -->\n/g, "")
      .replace(now, old);
    expect(legacy, "픽스처 자기검증 — 마커 없는 옛 판").not.toContain("<!-- uzys-harness:");
    expect(legacy, "픽스처 자기검증 — v26.152 앵커").toContain(`\n${OLD_ANCHOR_FIRST}\n`);
    expect(legacy).not.toContain(NOW_ANCHOR_FIRST);
    recordAsHarnessWritten(legacy);
    return legacy;
  };
  const uninstallAll = (): void => {
    uninstallAction(
      { projectDir, yes: true },
      {
        exit: () => undefined as never,
        log: () => {},
        err: () => {},
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
  };

  it("v26.152 이 남긴 마커 없는 AGENTS.md 를 고치지 않고 update — 은퇴한 옛 6원칙이 파일에 남지 않는다 · uninstall 이 파일째 지운다", () => {
    writeLegacy152();

    run("update");
    const after = agents();
    expect(after).not.toContain(OLD_ANCHOR_FIRST);
    expect(after).not.toContain("## 6. Keep authority explicit");
    expect(after.split(`\n${NOW_ANCHOR_FIRST}\n`).length - 1).toBe(1);
    run("update");
    expect(agents()).toBe(after);

    uninstallAll();
    expect(existsSync(agentsPath())).toBe(false);
  });

  it("v26.152 이 남긴 마커 없는 AGENTS.md 의 Project Rules 에 설치자가 적은 `## My rules` — update 뒤 그 절만 남고 옛 6원칙은 없다", () => {
    const legacy = writeLegacy152();
    const MINE = "## My rules\n\nMY-RULES-TEXT — 배포는 금요일에 하지 않는다.";
    writeFileSync(
      agentsPath(),
      legacy.replace("\n## Harness Rules\n", `\n${MINE}\n\n## Harness Rules\n`),
    );

    run("update");
    const after = agents();
    expect(after).toContain(MINE);
    expect(after).not.toContain(OLD_ANCHOR_FIRST);
    expect(after.split(`\n${NOW_ANCHOR_FIRST}\n`).length - 1).toBe(1);
    run("update");
    expect(agents()).toBe(after);
  });

  it("v26.152 앵커 절 본문에 설치자가 한 줄을 더했으면 — 그 절은 설치자 글로 남는다(제목만 같다고 지우지 않는다)", () => {
    const legacy = writeLegacy152();
    const ADDED = "MINE-ADDED-LINE — 우리 팀은 금요일 배포 금지.";
    expect(legacy, "픽스처 자기검증 — 덧쓸 자리").toContain("\n## Harness Rules\n");
    writeFileSync(
      agentsPath(),
      legacy.replace("\n## Harness Rules\n", `\n${ADDED}\n\n## Harness Rules\n`),
    );

    run("update");
    const after = agents();
    expect(after).toContain(ADDED);
    expect(after).toContain("## 6. Keep authority explicit");
    expect(after).not.toContain(OLD_ANCHOR_FIRST);
  });

  it("앵커 제목이 바뀐 판에서 update — 옛 앵커 절이 파일 끝에 되살아나지 않는다", () => {
    run();
    const NOW = "## 1. Understand what success means";
    const OLD = "## 1. Resolve what matters, then act";
    expect(agents(), "픽스처 자기검증 — 지금 앵커 제목").toContain(`\n${NOW}\n`);
    recordAsHarnessWritten(agents().replace(`\n${NOW}\n`, `\n${OLD}\n`));

    run("update");
    const after = agents();
    expect(after).not.toContain(OLD);
    expect(after.split(`\n${NOW}\n`).length - 1).toBe(1);
    expect(after.trimEnd().endsWith("직접 수정하지 않는다.")).toBe(true);
  });
});
