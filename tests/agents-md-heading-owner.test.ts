import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANCHOR_BLOCK,
  mergeAgentsMd,
  stripHarnessFromAgentsMd,
  wrapHarnessBlock,
} from "../src/agents-md-merge.js";
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
    const doc = (harnessRules: string, sessionStart: string, tail: string): string =>
      [
        "# P — Agent Guide (Codex)",
        "",
        "## Project Context",
        "",
        renderFillScaffold("agents-md"),
        "",
        "## Project Rules",
        "",
        wrapHarnessBlock(ANCHOR_BLOCK, "# Working Principles\n\n## 1. Principle\n\nbody"),
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
