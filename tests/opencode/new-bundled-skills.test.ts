/**
 * #531 (Epic #527 S3) — `update` 가 **새 릴리즈의 번들 스킬도** OpenCode 자리에 깐다.
 *
 * 여기서 재는 결함: `update` 는 `refreshOnly` 로 "디스크에 이미 있는 파일만" 갱신하므로
 * (ADR-049) 새로 생긴 번들 스킬이 `.agents/skills/<id>` 에 **영영 안 깔렸다**. `.claude/` 쪽은
 * `installNewSkillDirs` 가 따로 깔지만 그 함수는 claude 가 깔린 집합에 있을 때 `.claude/skills/`
 * 만 본다 — 그래서 OpenCode 를 쓰는 설치자는 재설치 전까지 새 스킬을 못 받았다.
 *
 * "새 릴리즈가 스킬을 더했다"는 **디스크의 스킬 디렉터리를 지우고 기준선에서도 빼는 것**으로
 * 재현한다(`#431` 형제 파일 테스트와 같은 픽스처 논리). 설치자가 직접 지운 경우와 같은 상태다.
 *
 * 반대 축도 같은 무게로 잰다 — **안 고른 것은 안 만든다**:
 *   - `--without <id>` 로 뺀 스킬은 update 가 되돌려 깔지 않는다 (#505 `skillExclude`).
 *   - opencode 가 깔린 집합에 없으면 `.agents/` 자체가 생기지 않는다.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CONTINUOUS_SKILLS } from "../../src/external-assets.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../../src/install-log.js";
import { runInstall } from "../../src/installer.js";
import type { CliTargets, InstallSpec } from "../../src/types.js";
import { expectedSkillRelFiles } from "../helpers/bundled-skill-dir.js";

const HARNESS_ROOT = resolve(__dirname, "../..");
const AGENTS_SKILLS = ".agents/skills";

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "oc-new-skills-"));
});

function spec(cli: CliTargets, forceExclude: ReadonlyArray<string> = []): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
    ...(forceExclude.length > 0 ? { userOverride: { forceInclude: [], forceExclude } } : {}),
  };
}

function install(cli: CliTargets, forceExclude: ReadonlyArray<string> = []): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli, forceExclude),
    mode: "add",
    runExternal: null,
  });
}

function update(cli: CliTargets) {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "update",
    runExternal: null,
  });
}

function skillIdsAt(dir: string): string[] {
  const root = join(dir, AGENTS_SKILLS);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function logOrThrow(): InstallLog {
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  return log;
}

/**
 * "이 릴리즈가 더한 스킬" 재현 — 디렉터리를 지우고 **기준선에서도 뺀다**. 기준선에 남겨 두면
 * "있었는데 사용자가 지웠다"가 되어 다른 경로를 재게 된다(#431 테스트와 같은 이유).
 */
function pretendNewInThisRelease(id: string): void {
  rmSync(join(projectDir, AGENTS_SKILLS, id), { recursive: true, force: true });
  const log = logOrThrow();
  const prefix = `${AGENTS_SKILLS}/${id}/`;
  writeInstallLog(projectDir, {
    ...log,
    externalFiles: (log.externalFiles ?? []).filter((f) => !f.path.startsWith(prefix)),
  });
}

/** 이 트랙 구성이 실제로 까는 번들 스킬 id — 열거 사본을 두지 않으려고 설치 결과에서 유도한다. */
let INSTALLED_IDS: string[] = [];
let probeDir: string;

beforeAll(() => {
  probeDir = mkdtempSync(join(tmpdir(), "oc-new-skills-probe-"));
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: probeDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["claude", "opencode"],
      projectDir: probeDir,
    },
    mode: "add",
    runExternal: null,
  });
  INSTALLED_IDS = skillIdsAt(probeDir);
  if (INSTALLED_IDS.length === 0) {
    throw new Error("tooling+opencode 설치가 번들 스킬을 0개 깔았다 — 이 파일은 아무것도 못 잰다");
  }
});

afterAll(() => {
  rmSync(probeDir, { recursive: true, force: true });
});

/** 첫 대상 스킬 (이름 정렬) — 어느 것이든 규칙은 같다. */
function subjectId(): string {
  return INSTALLED_IDS[0] as string;
}

/** 깔린 것 중 **상시 안내(ADR-085) 대상**인 첫 스킬 — AGENTS.md 안내 축을 재려면 이게 필요하다. */
function continuousId(): string {
  const id = CONTINUOUS_SKILLS.map((s) => s.id).find((s) => INSTALLED_IDS.includes(s));
  if (id === undefined) {
    throw new Error("설치된 번들 스킬 중 상시 안내 대상이 없다 — 안내 축을 잴 수 없다");
  }
  return id;
}

describe("update — 새 번들 스킬이 OpenCode 자리에 깔린다 (#531 S3)", () => {
  it("claude+opencode: `.agents/skills/<id>` 가 없으면 update 가 만들고 기준선에 기록한다", () => {
    install(["claude", "opencode"]);
    const id = subjectId();
    const fresh = readFileSync(join(projectDir, AGENTS_SKILLS, id, "SKILL.md"), "utf8");
    pretendNewInThisRelease(id);
    expect(existsSync(join(projectDir, AGENTS_SKILLS, id))).toBe(false);

    update(["claude", "opencode"]);

    // 본문까지 — 빈 디렉터리만 생기면 설치자에게는 아무것도 도달하지 않은 것이다.
    expect(readFileSync(join(projectDir, AGENTS_SKILLS, id, "SKILL.md"), "utf8")).toBe(fresh);
    for (const rel of expectedSkillRelFiles(HARNESS_ROOT, id)) {
      expect(existsSync(join(projectDir, AGENTS_SKILLS, id, rel)), `${rel} 미도달`).toBe(true);
    }
    // 기록이 없으면 다음 update 가 이 파일을 "판정 불가" 로 보고 매번 백업을 쌓는다.
    const recorded = (logOrThrow().externalFiles ?? []).map((f) => f.path);
    expect(recorded).toContain(`${AGENTS_SKILLS}/${id}/SKILL.md`);
    // 새로 만든 것이므로 사용자 편집분 백업은 0 이어야 한다.
    expect(
      readdirSync(join(projectDir, AGENTS_SKILLS, id)).filter((f) => f.includes(".backup")),
    ).toEqual([]);
  });

  it("opencode 단독 설치에서도 같다 — claude 자리를 거치지 않고 깔린다", () => {
    install(["opencode"]);
    const id = subjectId();
    pretendNewInThisRelease(id);

    update(["opencode"]);

    expect(existsSync(join(projectDir, AGENTS_SKILLS, id, "SKILL.md"))).toBe(true);
    // `.claude/skills/` 를 경유해 깔린 것이 아님을 못박는다 — claude 는 고른 적이 없다.
    expect(existsSync(join(projectDir, ".claude/skills", id))).toBe(false);
  });

  it("새로 깐 상시 스킬이 AGENTS.md 안내에 실린다 (ADR-085 · S6)", () => {
    install(["opencode"]);
    const id = continuousId();
    pretendNewInThisRelease(id);

    update(["opencode"]);

    // 안내가 빠지면 설치자의 에이전트는 그 스킬을 영영 안 연다 — 깔린 것과 같은 무게의 축이다.
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain(id);
  });
});

describe("update — 안 고른 것은 만들지 않는다 (#531 반대 축)", () => {
  it("`--without <id>` 로 뺀 스킬은 update 가 되돌려 깔지 않는다 (#505)", () => {
    const id = subjectId();
    install(["claude", "opencode"], [id]);
    // 픽스처 자기검증 — 설치가 실제로 뺐어야 "update 가 되살리나"를 잴 수 있다.
    expect(existsSync(join(projectDir, AGENTS_SKILLS, id))).toBe(false);
    expect(logOrThrow().spec.skillExclude ?? []).toContain(id);

    update(["claude", "opencode"]);

    expect(existsSync(join(projectDir, AGENTS_SKILLS, id))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/skills", id))).toBe(false);
  });

  it("claude 단독 설치본에는 `.agents/` 가 생기지 않는다 — opencode 가 집합에 없다", () => {
    install(["claude"]);

    update(["claude"]);

    expect(existsSync(join(projectDir, ".agents"))).toBe(false);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(false);
  });
});

describe("update — opencode 전용 산출물 회귀 대조군", () => {
  it("옛 `opencode.json` 은 여전히 최신판으로 갱신된다 — 백업 없이", () => {
    install(["claude", "opencode"]);
    const rel = "opencode.json";
    const fresh = readFileSync(join(projectDir, rel), "utf8");
    // 하네스 구버전이 깔아 둔 상태 — 디스크와 기준선을 **함께** 옛 내용으로 맞춘다. 그래야
    // 소유자 판정이 "사용자는 안 고쳤다"가 되어 백업 없이 덮어쓰는 경로가 재현된다.
    const stale = '{"$schema": "https://opencode.ai/config.json"}\n';
    writeFileSync(join(projectDir, rel), stale);
    const log = logOrThrow();
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: (log.externalFiles ?? []).map((f) =>
        f.path === rel ? { path: rel, sha256: hashContent(stale) } : f,
      ),
    });

    update(["claude", "opencode"]);

    expect(readFileSync(join(projectDir, rel), "utf8")).toBe(fresh);
    expect(readdirSync(projectDir).filter((f) => f.startsWith("opencode.json.backup"))).toEqual([]);
  });
});
