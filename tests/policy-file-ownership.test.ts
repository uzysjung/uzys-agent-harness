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
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  collectPolicyHashes,
  hashContent,
  installLogPath,
  POLICY_DIRS,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { pruneOrphans, updateDir } from "../src/update-mode.js";

/** `dir` 안에서 `name` 의 백업본들을 찾아 내용을 읽는다. 백업 명명 규칙에 의존하지 않기 위함. */
function backupContents(dir: string, name: string): string[] {
  return listFilesRecursive(dir)
    .filter((rel) => basename(rel).startsWith(`${name}.backup-`))
    .map((rel) => readFileSync(join(dir, rel), "utf8"));
}

describe("updateDir 소유자 판정 (ADR-047)", () => {
  let target = "";
  let source = "";

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "ch-pol-t-"));
    source = mkdtempSync(join(tmpdir(), "ch-pol-s-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
  });

  it("사용자가 고친 룰은 편집 내용이 백업본으로 살아남는다", () => {
    writeFileSync(join(source, "git-policy.md"), "harness v2\n");
    writeFileSync(join(target, "git-policy.md"), "harness v1 + MY EDIT\n");
    // 기준선 = 하네스가 놓아둔 원본. 디스크가 이것과 다르다 = 사용자가 고쳤다.
    const baseline = new Map([["rules/git-policy.md", hashContent("harness v1\n")]]);

    const result = updateDir(target, source, ".md", { prefix: "rules", baseline });

    expect(readFileSync(join(target, "git-policy.md"), "utf8")).toBe("harness v2\n");
    expect(backupContents(target, "git-policy.md")).toContain("harness v1 + MY EDIT\n");
    expect(result.backedUp).toContain("rules/git-policy.md");
  });

  it("사용자가 안 고친 룰은 백업 없이 덮어쓴다 (백업 노이즈 미축적)", () => {
    // 하네스가 개선해서 내용이 달라진 경우. 내용 비교만으로는 사용자 편집과 구분할 수 없어서
    // 기준선이 필요하다 — 이걸 빼면 릴리즈마다 전 사용자에게 백업본이 쌓인다.
    writeFileSync(join(source, "git-policy.md"), "harness v2\n");
    writeFileSync(join(target, "git-policy.md"), "harness v1\n");
    const baseline = new Map([["rules/git-policy.md", hashContent("harness v1\n")]]);

    const result = updateDir(target, source, ".md", { prefix: "rules", baseline });

    expect(readFileSync(join(target, "git-policy.md"), "utf8")).toBe("harness v2\n");
    expect(backupContents(target, "git-policy.md")).toEqual([]);
    expect(result.backedUp).toEqual([]);
  });

  it("기준선 기록이 없으면 보수적으로 백업한다 (레거시 설치의 첫 update)", () => {
    writeFileSync(join(source, "git-policy.md"), "harness v2\n");
    writeFileSync(join(target, "git-policy.md"), "unknown provenance\n");

    const result = updateDir(target, source, ".md", { prefix: "rules", baseline: new Map() });

    expect(backupContents(target, "git-policy.md")).toContain("unknown provenance\n");
    expect(result.backedUp).toContain("rules/git-policy.md");
  });

  it("이미 최신이면 백업도 쓰기도 하지 않는다", () => {
    writeFileSync(join(source, "git-policy.md"), "same\n");
    writeFileSync(join(target, "git-policy.md"), "same\n");

    const result = updateDir(target, source, ".md", { prefix: "rules", baseline: new Map() });

    expect(backupContents(target, "git-policy.md")).toEqual([]);
    expect(result.updated).toBe(0);
  });

  it("훅(.sh)도 같은 판정을 받는다 — 자산 종류에 따라 보호가 갈리지 않는다", () => {
    writeFileSync(join(source, "session-start.sh"), "echo v2\n");
    writeFileSync(join(target, "session-start.sh"), "echo v1 # MY EDIT\n");
    const baseline = new Map([["hooks/session-start.sh", hashContent("echo v1\n")]]);

    const result = updateDir(target, source, ".sh", { prefix: "hooks", baseline });

    expect(backupContents(target, "session-start.sh")).toContain("echo v1 # MY EDIT\n");
    expect(result.backedUp).toContain("hooks/session-start.sh");
  });
});

describe("pruneOrphans 소유자 판정 (ADR-047)", () => {
  let target = "";
  let source = "";

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "ch-prn-t-"));
    source = mkdtempSync(join(tmpdir(), "ch-prn-s-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
  });

  it("사용자가 직접 만든 룰은 지우지 않는다", () => {
    // 이것이 이 변경의 핵심 회귀다. templates 에 없다는 이유로 지우면 그게 곧 사용자 파일 삭제다.
    writeFileSync(join(target, "my-team-rule.md"), "our convention\n");

    const removed = pruneOrphans(target, source, ".md", { prefix: "rules", baseline: new Map() });

    expect(existsSync(join(target, "my-team-rule.md"))).toBe(true);
    expect(removed).toEqual([]);
  });

  it("하네스가 깔았던 룰이 templates 에서 빠지면 지운다 (폐기 룰 회수)", () => {
    writeFileSync(join(target, "deprecated-rule.md"), "old harness rule\n");
    const baseline = new Map([["rules/deprecated-rule.md", hashContent("old harness rule\n")]]);

    const removed = pruneOrphans(target, source, ".md", { prefix: "rules", baseline });

    expect(existsSync(join(target, "deprecated-rule.md"))).toBe(false);
    expect(removed).toEqual(["deprecated-rule.md"]);
  });

  it("하네스가 깔았지만 사용자가 고친 룰은 지우기 전에 내용을 남긴다", () => {
    writeFileSync(join(target, "deprecated-rule.md"), "old harness rule + MY EDIT\n");
    const baseline = new Map([["rules/deprecated-rule.md", hashContent("old harness rule\n")]]);

    pruneOrphans(target, source, ".md", { prefix: "rules", baseline });

    expect(existsSync(join(target, "deprecated-rule.md"))).toBe(false);
    expect(backupContents(target, "deprecated-rule.md")).toContain("old harness rule + MY EDIT\n");
  });
});

describe("collectPolicyHashes 기준선", () => {
  let projectDir = "";
  let templatesDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-cph-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-cph-t-"));
    for (const { dir } of POLICY_DIRS) {
      mkdirSync(join(templatesDir, dir), { recursive: true });
      mkdirSync(join(projectDir, ".claude", dir), { recursive: true });
    }
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it("templates 에 있는 파일만 하네스 소유로 기록한다", () => {
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "v1\n");
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "v1\n");
    writeFileSync(join(projectDir, ".claude/rules/my-team-rule.md"), "mine\n"); // templates 에 없음

    const hashes = collectPolicyHashes(projectDir, templatesDir);
    const paths = hashes.map((h) => h.path);

    expect(paths).toContain("rules/git-policy.md");
    expect(paths).not.toContain("rules/my-team-rule.md");
  });

  it("디스크에 있는 내용의 해시를 기록한다 (다음 update 의 판정 기준)", () => {
    writeFileSync(join(templatesDir, "hooks/session-start.sh"), "echo hi\n");
    writeFileSync(join(projectDir, ".claude/hooks/session-start.sh"), "echo hi\n");

    const hashes = collectPolicyHashes(projectDir, templatesDir);

    expect(hashes.find((h) => h.path === "hooks/session-start.sh")?.sha256).toBe(
      hashContent("echo hi\n"),
    );
  });

  it("POLICY_DIRS 가 update 대상과 같은 SSOT 를 쓴다 (열거 사본 방지)", () => {
    // 정책 디렉터리 목록이 두 곳에 하드코딩되면 한쪽만 늘었을 때 조용히 갈린다.
    // 이 repo 가 반복해서 당한 실패 모드라 목록 자체를 계약으로 고정한다.
    expect(POLICY_DIRS.map((d) => d.dir)).toEqual(["rules", "agents", "commands/uzys", "hooks"]);
    expect(POLICY_DIRS.find((d) => d.dir === "hooks")?.ext).toBe(".sh");
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
        options: { withPrune: false, withCodexTrust: false, withKarpathyHook: false },
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

describe("정책 파일 보호 계약 (회귀 가드)", () => {
  it("updateDir 은 baseline 없이 조용히 덮어쓰는 경로를 갖지 않는다", () => {
    // 옛 시그니처(3-arg)로 부르면 타입 에러가 나야 한다. 런타임에서도 ctx 부재 시
    // "판정 불가 → 보수적 백업"으로 떨어져야지, 무조건 덮어쓰기로 떨어지면 안 된다.
    const target = mkdtempSync(join(tmpdir(), "ch-cnt-t-"));
    const source = mkdtempSync(join(tmpdir(), "ch-cnt-s-"));
    try {
      writeFileSync(join(source, "r.md"), "new\n");
      writeFileSync(join(target, "r.md"), "user content\n");
      mkdirSync(dirname(join(target, "r.md")), { recursive: true });

      const result = updateDir(target, source, ".md", { prefix: "rules", baseline: new Map() });

      expect(result.backedUp.length).toBeGreaterThan(0);
      expect(backupContents(target, "r.md")).toContain("user content\n");
    } finally {
      rmSync(target, { recursive: true, force: true });
      rmSync(source, { recursive: true, force: true });
    }
  });
});
