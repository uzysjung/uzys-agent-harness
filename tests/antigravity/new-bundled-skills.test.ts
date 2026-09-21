/**
 * #532 (Epic #527 S3) — `update` 가 **antigravity 의 자리**(`.agents/skills/<id>`)에도 번들
 * 스킬을 깐다.
 *
 * 결함(실측 2026-09-22): `update` 는 외부 CLI 산출물을 `refreshOnly` 로 갱신하고, 그 모드는
 * **없는 파일을 만들지 않는다**. 그래서 새 릴리즈가 더한 번들 스킬은 `.claude/skills/` 에만
 * 깔리고(`installNewSkillDirs`, #480) Antigravity 사용자는 재설치 전에는 영영 못 받았다.
 * 설치자가 `.agents/skills/<id>` 를 지운 경우도 같은 자리에서 막혔다.
 *
 * 여기서 무는 것 —
 *   ① 깔린 집합에 antigravity 가 있으면 없는 자리를 만든다 (claude 와 함께 깐 경우)
 *   ② `--without <skill>` 로 뺀 것은 만들지 않는다 (#505 유지)
 *   ③ 안 고른 CLI 에는 절대 만들지 않는다 (claude 단독 → `.agents/` 없음)
 *   ④ antigravity 단독 설치에서도 ① 이 성립한다
 *   ⑤ 새로 만든 스킬이 `.agents/rules/uzys-harness.md` 의 상시 안내에 들어간다 (ADR-085)
 *   ⑥ 회귀 대조군 — 룰 파일 옛 판은 여전히 최신판으로 갱신된다
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { hashContent, readInstallLog, writeInstallLog } from "../../src/install-log.js";
import { runInstall } from "../../src/installer.js";
import type { InstallSpec } from "../../src/types.js";

const HARNESS_ROOT = join(__dirname, "../..");

/** 대상 표본. 상시 안내(CONTINUOUS_SKILLS)에 드는 스킬이라 ⑤ 도 같은 표본으로 잰다. */
const SKILL = "user-centered-explanation";
/** ② 의 표본 — 상시 안내와 무관한 번들 스킬. */
const DROPPED = "north-star";

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agy-new-skills-"));
});

function install(cli: InstallSpec["cli"], without: ReadonlyArray<string> = []): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir,
      ...(without.length > 0 ? { userOverride: { forceInclude: [], forceExclude: without } } : {}),
    },
    mode: "add",
    runExternal: null,
  });
}

/** `update` 는 `.claude/` 만 spec 으로 받는다 — 외부 CLI 는 설치 로그·디스크가 판정한다. */
function update() {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["claude"],
      projectDir,
    },
    mode: "update",
    runExternal: null,
  });
}

function agentsSkill(id: string): string {
  return join(projectDir, ".agents/skills", id, "SKILL.md");
}

/**
 * "새 릴리즈가 더한 스킬" 상태를 만든다 — **두 자리 모두** 없애야 update 가 넘겨 주는 목록
 * (`installedBundledSkills`, 디스크에서 유도)에서 그 id 가 빠진다. 한쪽만 지우면 다른 자리의
 * 존재 때문에 목록에 남아 이 픽스처가 재려는 상태가 아니다.
 */
function dropSkillEverywhere(id: string): void {
  rmSync(join(projectDir, ".agents/skills", id), { recursive: true, force: true });
  rmSync(join(projectDir, ".claude/skills", id), { recursive: true, force: true });
}

function ruleFile(): string {
  return join(projectDir, ".agents/rules/uzys-harness.md");
}

describe("update — antigravity 자리에 번들 스킬을 깐다 (#532 · Epic #527 S3)", () => {
  it("① claude+antigravity — 없는 `.agents/skills/<id>` 를 만들고 기준선에 기록한다", () => {
    install(["claude", "antigravity"]);
    expect(existsSync(agentsSkill(SKILL))).toBe(true); // 전제
    dropSkillEverywhere(SKILL);
    expect(existsSync(agentsSkill(SKILL))).toBe(false);

    update();

    expect(existsSync(agentsSkill(SKILL))).toBe(true);
    // 번들 원본과 같은 본문인지 — 빈 파일을 만들어 놓고 "깔았다"고 하지 않는다.
    expect(readFileSync(agentsSkill(SKILL), "utf8")).toContain("name: user-centered-explanation");
    // 기록 — 다음 update 가 이 파일을 "사용자 편집분"으로 오판해 백업을 쌓으면 안 된다.
    const log = readInstallLog(projectDir);
    expect((log?.externalFiles ?? []).map((f) => f.path)).toContain(
      `.agents/skills/${SKILL}/SKILL.md`,
    );
  });

  it("① 이어서 — 두 번째 update 는 백업을 만들지 않는다 (기준선이 이어진다)", () => {
    install(["claude", "antigravity"]);
    dropSkillEverywhere(SKILL);
    update();

    const report = update();

    // 먼저 "잴 것이 있는가" — 자리가 비어 있으면 백업 0 은 아무것도 증명하지 않는다.
    expect(existsSync(agentsSkill(SKILL))).toBe(true);
    expect(report.updateMode?.externalBackedUp ?? []).toEqual([]);
  });

  it("② `--without <skill>` 로 뺀 스킬은 만들지 않는다 (#505 유지)", () => {
    install(["claude", "antigravity"], [DROPPED]);
    expect(readInstallLog(projectDir)?.spec.skillExclude).toContain(DROPPED);
    expect(existsSync(agentsSkill(DROPPED))).toBe(false); // 전제

    update();

    expect(existsSync(agentsSkill(DROPPED))).toBe(false);
    // 대조군 — 빼지 않은 스킬은 같은 실행에서 그대로 있다(이 판정기가 무는지 먼저 보인다).
    expect(existsSync(agentsSkill(SKILL))).toBe(true);
  });

  it("③ claude 단독 설치에는 `.agents/` 자체가 생기지 않는다", () => {
    install(["claude"]);
    expect(existsSync(join(projectDir, ".agents"))).toBe(false); // 전제
    rmSync(join(projectDir, ".claude/skills", SKILL), { recursive: true, force: true });

    update();

    expect(existsSync(agentsSkill(SKILL))).toBe(false);
    expect(existsSync(join(projectDir, ".agents"))).toBe(false);
    // 대조군 — claude 자리에는 #480 경로로 되돌아온다. 아무 일도 안 일어난 실행이 아니다.
    expect(existsSync(join(projectDir, ".claude/skills", SKILL, "SKILL.md"))).toBe(true);
  });

  it("④ antigravity 단독 설치에서도 없는 자리를 만든다", () => {
    install(["antigravity"]);
    expect(existsSync(join(projectDir, ".claude"))).toBe(false); // 전제 — 자리는 하나뿐
    rmSync(join(projectDir, ".agents/skills", SKILL), { recursive: true, force: true });

    update();

    expect(existsSync(agentsSkill(SKILL))).toBe(true);
  });

  it("⑤ 새로 만든 스킬이 룰 파일의 상시 안내에 들어간다 (ADR-085)", () => {
    install(["antigravity"]);
    rmSync(join(projectDir, ".agents/skills", SKILL), { recursive: true, force: true });
    // 룰 파일에서도 그 안내를 지운다 — 남아 있으면 "이번에 들어갔다"를 못 가른다.
    const stripped = readFileSync(ruleFile(), "utf8")
      .split("\n")
      .filter((l) => !l.includes(SKILL))
      .join("\n");
    writeFileSync(ruleFile(), stripped);
    pretendHarnessOwned(".agents/rules/uzys-harness.md", stripped);
    expect(readFileSync(ruleFile(), "utf8")).not.toContain(SKILL); // 전제

    update();

    expect(readFileSync(ruleFile(), "utf8")).toContain(SKILL);
  });

  it("⑥ 회귀 대조군 — 룰 파일 옛 판은 최신판으로 갱신된다", () => {
    install(["antigravity"]);
    const fresh = readFileSync(ruleFile(), "utf8");
    pretendHarnessOwned(".agents/rules/uzys-harness.md", "# v26.1.0 시절 룰 파일\n");

    update();

    expect(readFileSync(ruleFile(), "utf8")).toBe(fresh);
  });
});

/**
 * "하네스 구버전이 깔아 둔 상태" — 디스크를 옛 내용으로 바꾸고 **기준선도 그 해시로** 맞춘다.
 * 그래야 소유자 판정이 "사용자는 안 고쳤다"가 되어 백업 없이 최신판으로 덮이는 경로가 재현된다
 * (`tests/external-cli-update.test.ts` 의 `pretendStale` 과 같은 픽스처).
 */
function pretendHarnessOwned(rel: string, content: string): void {
  writeFileSync(join(projectDir, rel), content);
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  writeInstallLog(projectDir, {
    ...log,
    externalFiles: (log.externalFiles ?? []).map((f) =>
      f.path === rel ? { path: rel, sha256: hashContent(content) } : f,
    ),
  });
}
