/**
 * #796 검증 BLOCKER-1 — 부분 update(`--only hooks`)가 은퇴 경로 하나를 이어 적은 뒤에도 하네스 룰은 하네스 것으로 읽힌다.
 *
 * 설치자에게 달라지는 것: 기록 필드가 없는 옛 설치본(v26.125.0 이하)에 옛 판이 깐 은퇴 룰(`rules/nextjs.md`)이 남아 있을 때
 * `update --only hooks` 를 한 번 돌리면, 다음 update 가 하네스 룰 전부를 "설치자 파일" 로 적었다 — 고친 룰은 백업 뒤
 * displaced(uninstall 이 **옛 하네스 바이트를 제자리로 되돌린다**), 그대로인 룰은 displacedSame(uninstall 이 남긴다). 이제
 * 하네스 룰은 체크섬 없는 옛 하네스 파일로 읽혀 갱신되고(다르면 1회 백업) 기록에 하네스 것으로 실린다.
 *
 * 원인: `retiredClaims` 가 이어 적은 `rules/nextjs.md` 하나를 `scanFieldOf` 가 "그 디렉터리를 다 훑은 기록" 으로 셌다.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type InstallLog, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { RETIRED_PATHS } from "../src/manifest.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES_DIR = join(HARNESS_ROOT, "templates");
const RETIRED = "rules/nextjs.md";
const GIT_POLICY = ".claude/rules/git-policy.md";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "partial-retired-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const log = (): InstallLog => {
  const l = readInstallLog(projectDir);
  if (l === null) throw new Error("설치 로그가 없다 — 시나리오 전제가 깨졌다");
  return l;
};

describe("BLOCKER-1 — `--only hooks` 가 이어 적은 은퇴 항목이 하네스 룰을 첫 접촉으로 뒤집지 않는다", () => {
  it("옛 로그(필드 없음) + 은퇴 룰 → `--only hooks` → 전체 update: 하네스 룰이 displaced/displacedSame 에 없다", () => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
    });
    // v26.125.0 이하의 기록 모양 — 파일 필드가 없다
    const l = log();
    delete l.records;
    delete l.policyFiles;
    delete l.skillFiles;
    delete l.externalFiles;
    delete l.portions;
    writeInstallLog(projectDir, l);
    // 그 판이 깐 은퇴 룰 · 그 판의 하네스 룰(지금 템플릿과 다른 바이트)
    expect(RETIRED_PATHS).toContain(RETIRED);
    expect(existsSync(join(TEMPLATES_DIR, RETIRED))).toBe(false);
    writeFileSync(join(projectDir, ".claude", RETIRED), "# old harness nextjs rule\n");
    const gp = join(projectDir, GIT_POLICY);
    writeFileSync(gp, `${readFileSync(gp, "utf8")}\n<!-- older release bytes -->\n`);

    runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT, {}, ["hooks"]);
    // 전제 — 부분 실행이 은퇴 항목을 이어 적었고 rules/ 는 쓰지 않았다
    const after = (log().policyFiles ?? []).map((f) => f.path);
    expect(after).toContain(RETIRED);
    expect(after).not.toContain("rules/git-policy.md");

    const r = runUpdateMode(projectDir, TEMPLATES_DIR, HARNESS_ROOT);

    const rules = (paths: readonly string[] | undefined): string[] =>
      (paths ?? []).filter((p) => p.startsWith(".claude/rules/"));
    expect(rules(r.displaced)).toEqual([]);
    expect(rules(r.displacedSame)).toEqual([]);
    expect(
      (log().rootFiles ?? []).filter(
        (f) => f.change === "displaced" && f.path.startsWith(".claude/rules/"),
      ),
    ).toEqual([]);
    // 체크섬 없는 옛 하네스 룰로 읽혔다 — 갱신되고 하네스 것으로 기록된다
    expect(r.noChecksum ?? []).toContain(GIT_POLICY);
    expect(readFileSync(gp, "utf8")).toBe(
      readFileSync(join(TEMPLATES_DIR, "rules/git-policy.md"), "utf8"),
    );
    expect((log().policyFiles ?? []).map((f) => f.path)).toContain("rules/git-policy.md");
  });
});
