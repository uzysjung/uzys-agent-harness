/**
 * 정책 파일(rules/agents/commands/hooks) 소유자 판정 — ADR-047.
 *
 * **왜 이 테스트가 있는가**: v26.126.0 (ADR-046) 이 "사용자 편집분을 잃지 않는다"를 도입했지만
 * 실제 커버리지는 `.claude/skills/` 뿐이었다. 같은 update 실행 안에서 스킬은 백업을 받고
 * 룰·훅은 `copyFileSync` 로 조용히 밀렸다. install 은 더 나빠서 `.claude/settings.json` 하나만
 * 보호했다. 사용자가 직접 만든 커스텀 룰은 prune 이 백업 없이 지웠다.
 *
 * 여기 테스트는 "백업 파일이 생긴다"가 아니라 **사용자가 쓴 내용이 살아남는가**를 검증한다 —
 * 백업 경로 이름이 바뀌어도 통과해야 하고, 내용이 소실되면 반드시 실패해야 한다.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  hashContent,
  installLogPath,
  POLICY_DIRS,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { RETIRED_PATHS } from "../src/manifest.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/** `dir` 안에서 `name` 의 백업본들을 찾아 내용을 읽는다. 백업 명명 규칙에 의존하지 않기 위함. */
function backupContents(dir: string, name: string): string[] {
  return listFilesRecursive(dir)
    .filter((rel) => basename(rel).startsWith(`${name}.backup-`))
    .map((rel) => readFileSync(join(dir, rel), "utf8"));
}

/**
 * update 의 정책 파일 판정 — #796 부터 install 과 같은 writer(`judge`)로 쓴다. 판정 행은 `judge.test.ts` 가 행마다 문다 — 여기서는
 * `runUpdateMode` 로 **사용자가 쓴 내용이 살아남는가**와 기록이 무엇을 담는가를 본다.
 */
describe("update 의 정책 파일 소유자 판정 (ADR-047)", () => {
  let projectDir = "";
  let templatesDir = "";
  const rules = (): string => join(projectDir, ".claude/rules");

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-pol-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-pol-t-"));
    for (const { dir } of POLICY_DIRS) {
      mkdirSync(join(templatesDir, dir), { recursive: true });
      mkdirSync(join(projectDir, ".claude", dir), { recursive: true });
    }
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  /** `policyFiles` 를 받으면 지금 판의 기록(쓰기 = 기록), 안 받으면 체크섬 이전 옛 판(필드 없음). */
  function log(policyFiles?: Record<string, string>): void {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
      ...(policyFiles === undefined
        ? {}
        : {
            records: "writer" as const,
            policyFiles: Object.entries(policyFiles).map(([path, text]) => ({
              path,
              sha256: hashContent(text),
            })),
          }),
    });
  }

  const update = () =>
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT, {}, ["rules", "hooks"]);

  it("사용자가 고친 룰은 편집 내용이 백업본으로 살아남는다", () => {
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "harness v2\n");
    writeFileSync(join(rules(), "git-policy.md"), "harness v1 + MY EDIT\n");
    // 기록 = 하네스가 놓아둔 원본. 디스크가 이것과 다르다 = 사용자가 고쳤다.
    log({ "rules/git-policy.md": "harness v1\n" });

    const report = update();

    expect(readFileSync(join(rules(), "git-policy.md"), "utf8")).toBe("harness v2\n");
    expect(backupContents(rules(), "git-policy.md")).toContain("harness v1 + MY EDIT\n");
    expect(report.policyBackedUp).toContain("rules/git-policy.md");
  });

  it("사용자가 안 고친 룰은 백업 없이 덮어쓴다 (백업 노이즈 미축적)", () => {
    // 하네스가 개선해서 내용이 달라진 경우. 내용 비교만으로는 사용자 편집과 구분할 수 없어서
    // 기록이 필요하다 — 이걸 빼면 릴리즈마다 전 사용자에게 백업본이 쌓인다.
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "harness v2\n");
    writeFileSync(join(rules(), "git-policy.md"), "harness v1\n");
    log({ "rules/git-policy.md": "harness v1\n" });

    const report = update();

    expect(readFileSync(join(rules(), "git-policy.md"), "utf8")).toBe("harness v2\n");
    expect(backupContents(rules(), "git-policy.md")).toEqual([]);
    expect(report.policyBackedUp).toEqual([]);
  });

  it("기록에 체크섬이 없으면 보수적으로 백업한다 (레거시 설치의 첫 update)", () => {
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "harness v2\n");
    writeFileSync(join(rules(), "git-policy.md"), "unknown provenance\n");
    log();

    const report = update();

    expect(backupContents(rules(), "git-policy.md")).toContain("unknown provenance\n");
    expect(report.policyBackedUp).toContain("rules/git-policy.md");
    expect(report.noChecksum).toContain(".claude/rules/git-policy.md");
  });

  it("이미 최신이면 백업도 쓰기도 하지 않는다", () => {
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "same\n");
    writeFileSync(join(rules(), "git-policy.md"), "same\n");
    log();

    const report = update();

    expect(backupContents(rules(), "git-policy.md")).toEqual([]);
    expect(report.updated[".claude/rules"]).toBe(0);
  });

  it("훅(.sh)도 같은 판정을 받는다 — 자산 종류에 따라 보호가 갈리지 않는다", () => {
    writeFileSync(join(templatesDir, "hooks/session-start.sh"), "echo v2\n");
    const hooks = join(projectDir, ".claude/hooks");
    writeFileSync(join(hooks, "session-start.sh"), "echo v1 # MY EDIT\n");
    log({ "hooks/session-start.sh": "echo v1\n" });

    const report = update();

    expect(backupContents(hooks, "session-start.sh")).toContain("echo v1 # MY EDIT\n");
    expect(report.policyBackedUp).toContain("hooks/session-start.sh");
  });

  it("기록은 이번에 쓴 하네스 파일의 sha 만 담는다 — 같은 폴더의 설치자 파일은 적지 않는다", () => {
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "v2\n");
    writeFileSync(join(rules(), "git-policy.md"), "v1\n");
    writeFileSync(join(rules(), "my-team-rule.md"), "mine\n"); // templates 에 없음
    log({ "rules/git-policy.md": "v1\n" });

    update();

    const recorded = readInstallLog(projectDir)?.policyFiles ?? [];
    expect(recorded.find((f) => f.path === "rules/git-policy.md")?.sha256).toBe(
      hashContent("v2\n"),
    );
    expect(recorded.map((f) => f.path)).not.toContain("rules/my-team-rule.md");
    expect(readFileSync(join(rules(), "my-team-rule.md"), "utf8")).toBe("mine\n");
  });
});

/**
 * update 의 은퇴 회수 — 템플릿에 없는 정책 파일을 치울지·백업할지를 **설치 기록 하나**(`recorded()` → `judge(op: remove)`)로
 * 정한다(#796 PR-B · 설계 §5.5). 설치자 파일이 백업 없이 지워지는 길이 없어야 한다 — 내용이 살아남는지를 본다.
 */
describe("update 의 은퇴 회수 — 설치 기록이 판정한다 (ADR-047 · #796 §5.5)", () => {
  let projectDir = "";
  let templatesDir = "";
  const rules = (): string => join(projectDir, ".claude/rules");
  const recordedPaths = (): string[] =>
    (readInstallLog(projectDir)?.policyFiles ?? []).map((f) => f.path);

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-prn-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-prn-t-"));
    for (const { dir } of POLICY_DIRS) {
      mkdirSync(join(templatesDir, dir), { recursive: true });
      mkdirSync(join(projectDir, ".claude", dir), { recursive: true });
    }
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  /**
   * `scan` = 기록 모양 — `writer`(지금 판: 쓰는 순간 적는다) · `old`(v26.132–161 의 옛 스캔: 설치 뒤 디스크를 훑어 적었다 —
   * `records` 표시 없음) · `none`(v26.125 이하: 파일 필드 자체가 없다).
   */
  function log(scan: "writer" | "old" | "none", policyFiles: Record<string, string> = {}): void {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
      ...(scan === "writer" ? { records: "writer" as const } : {}),
      ...(scan === "none"
        ? {}
        : {
            policyFiles: Object.entries(policyFiles).map(([path, text]) => ({
              path,
              sha256: hashContent(text),
            })),
          }),
    });
  }

  const update = () =>
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT, {}, ["rules", "hooks"]);

  it("사용자가 직접 만든 룰은 지우지 않는다", () => {
    // 이것이 ADR-047 의 핵심 회귀다. templates 에 없다는 이유로 지우면 그게 곧 사용자 파일 삭제다.
    writeFileSync(join(rules(), "my-team-rule.md"), "our convention\n");
    log("writer", { "rules/git-policy.md": "v1\n" });

    const report = update();

    expect(readFileSync(join(rules(), "my-team-rule.md"), "utf8")).toBe("our convention\n");
    expect(report.pruned[".claude/rules"]).toEqual([]);
  });

  it("하네스가 깔았던 룰이 templates 에서 빠지면 백업 없이 지우고 기록에서도 뺀다 — 템플릿에 있는 것 · 다른 확장자는 그대로", () => {
    writeFileSync(join(templatesDir, "rules/alive.md"), "alive\n");
    writeFileSync(join(rules(), "alive.md"), "alive\n");
    writeFileSync(join(rules(), "deprecated-rule.md"), "old harness rule\n");
    writeFileSync(join(rules(), "stale.txt"), "x\n");
    log("writer", {
      "rules/alive.md": "alive\n",
      "rules/deprecated-rule.md": "old harness rule\n",
      "rules/stale.txt": "x\n",
    });

    const report = update();

    expect(report.pruned[".claude/rules"]).toEqual(["deprecated-rule.md"]);
    expect(existsSync(join(rules(), "deprecated-rule.md"))).toBe(false);
    expect(backupContents(rules(), "deprecated-rule.md")).toEqual([]);
    expect(existsSync(join(rules(), "alive.md"))).toBe(true);
    expect(existsSync(join(rules(), "stale.txt"))).toBe(true);
    expect(recordedPaths()).not.toContain("rules/deprecated-rule.md");
  });

  it("하네스가 깔았지만 사용자가 고친 룰은 지우기 전에 내용을 남긴다", () => {
    writeFileSync(join(rules(), "deprecated-rule.md"), "old harness rule + MY EDIT\n");
    log("writer", { "rules/deprecated-rule.md": "old harness rule\n" });

    update();

    expect(existsSync(join(rules(), "deprecated-rule.md"))).toBe(false);
    expect(backupContents(rules(), "deprecated-rule.md")).toContain("old harness rule + MY EDIT\n");
  });

  it("§1.2 ③ — 파일 필드 없는 옛 로그(v26.125 이하)의 은퇴 룰은 첫 update 가 백업 뒤 치운다", () => {
    // 은퇴 이름의 파일 — 그 판이 깐 것인지 설치자가 쓴 것인지 기록이 말하지 못한다(체크섬 없음). 내용은 백업에 산다
    expect(RETIRED_PATHS).toContain("rules/database.md");
    writeFileSync(join(rules(), "database.md"), "my own database notes\n");
    log("none");

    const report = update();

    expect(report.pruned[".claude/rules"]).toEqual(["database.md"]);
    expect(existsSync(join(rules(), "database.md"))).toBe(false);
    expect(backupContents(rules(), "database.md")).toContain("my own database notes\n");
    expect(report.noChecksum).toContain(".claude/rules/database.md");
    // 치운 자리는 기록에 남지 않는다 — 다음 update 가 다시 손대지 않는다
    expect(recordedPaths()).not.toContain("rules/database.md");
  });

  it("§1.2 ④ — 옛 스캔이 적었지만 기록이 하네스 것이라 말하지 않는 항목은 sha 가 같아도 지우지 않는다", () => {
    // v26.132–161 의 스캔은 템플릿과 이름이 같은 파일을 전부 적었다 — 기록 트랙(tooling) 밖 템플릿 이름의 설치자 파일도.
    // 그 이름이 번들에서 빠지고(합성 templates 에 없다) 은퇴 목록(`RETIRED_PATHS`)에도 없으면 기록은 그 파일을 "하네스 것" 이라
    // 말하지 않는다(`recorded()` none). 옛 회수는 기록 필드의 sha 만 보고 같으면 백업 없이 지웠다
    expect(RETIRED_PATHS).not.toContain("rules/ui-components.md");
    writeFileSync(join(rules(), "ui-components.md"), "our ui rule\n");
    log("old", { "rules/ui-components.md": "our ui rule\n" });

    const report = update();

    expect(readFileSync(join(rules(), "ui-components.md"), "utf8")).toBe("our ui rule\n");
    expect(report.pruned[".claude/rules"]).toEqual([]);
  });
});

/**
 * install 경로 (사용자가 실제로 보고한 증상: "재설치하면 rules·hooks 를 그냥 덮친다").
 *
 * update 경로 테스트가 이 경로의 증거가 되지 않는다 — 둘은 다른 코드(`installer.ts` manifest
 * 복사 vs `update-mode.ts` 동기화)를 탄다. 실제 `templates/` 로 돈다.
 */
describe("install 재설치 시 정책 파일 보호 (ADR-047)", () => {
  let projectDir = "";
  const RULE = ".claude/rules/git-policy.md";

  function install(): void {
    runInstall({
      runExternal: null,
      harnessRoot: resolve(__dirname, ".."),
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
    });
  }

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-inst-pol-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("설치가 정책 파일 기준선을 기록한다 (다음 재설치·update 의 판정 근거)", () => {
    install();
    const log = JSON.parse(readFileSync(installLogPath(projectDir), "utf8"));
    expect(log.policyFiles?.length ?? 0).toBeGreaterThan(0);
    expect(log.policyFiles.map((f: { path: string }) => f.path)).toContain("rules/git-policy.md");
  });

  it("재설치가 사용자가 고친 룰을 덮치지 않는다 (편집 내용이 살아남는다)", () => {
    install();
    const rulePath = join(projectDir, RULE);
    writeFileSync(rulePath, `${readFileSync(rulePath, "utf8")}\n<!-- MY TEAM EDIT -->\n`);

    install(); // 재설치

    expect(backupContents(join(projectDir, ".claude/rules"), "git-policy.md").join("")).toContain(
      "MY TEAM EDIT",
    );
  });

  it("사용자가 안 고쳤으면 재설치해도 백업이 쌓이지 않는다", () => {
    install();
    install();
    install();

    expect(backupContents(join(projectDir, ".claude/rules"), "git-policy.md")).toEqual([]);
  });

  it("사용자가 고친 훅도 같은 보호를 받는다", () => {
    install();
    const hooks = join(projectDir, ".claude/hooks");
    const hook = listFilesRecursive(hooks).find((f) => f.endsWith(".sh"));
    expect(hook, "설치된 훅이 없으면 이 테스트가 아무것도 검증하지 않는다").toBeDefined();
    const hookPath = join(hooks, hook as string);
    writeFileSync(hookPath, `${readFileSync(hookPath, "utf8")}\n# MY HOOK EDIT\n`);

    install();

    expect(backupContents(hooks, basename(hook as string)).join("")).toContain("MY HOOK EDIT");
  });
});
