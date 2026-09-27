/**
 * #530 · #531 · #532 (Epic #527 S3) — `update` 가 **새 릴리즈의 번들 스킬을** 공유 자리
 * `.agents/skills/<id>/`(Codex · OpenCode · Antigravity 공용)에 깐다. 판정 모듈 하나
 * (`src/agents-skill-targets.ts`)가 세 CLI 를 모두 맡으므로 테스트도 CLI 를 매개변수로 돌린다.
 *
 * 여기서 재는 결함: `update` 는 `refreshOnly` 로 "디스크에 이미 있는 파일만" 갱신하므로
 * (ADR-049) 새로 생긴 번들 스킬이 `.agents/skills/<id>` 에 **영영 안 깔렸다**. `.claude/` 쪽은
 * `installNewSkillDirs` 가 따로 깔지만 그 함수는 claude 가 깔린 집합에 있을 때 `.claude/skills/`
 * 만 본다 — 그래서 Claude 밖 CLI 를 쓰는 설치자는 재설치 전까지 새 스킬을 못 받았다.
 *
 * "새 릴리즈가 스킬을 더했다"는 **디스크의 스킬 디렉터리를 지우고 기준선에서도 빼는 것**으로
 * 재현한다(`#431` 형제 파일 테스트와 같은 픽스처 논리). 설치자가 직접 지운 경우와 같은 상태다.
 *
 * 반대 축도 같은 무게로 잰다 — **안 고른 것은 안 만든다**:
 *   ② `--without <id>` 로 뺀 스킬은 update 가 되돌려 깔지 않는다 (#505 `skillExclude`)
 *   ③ 세 CLI 가 하나도 없는 설치본에는 `.agents/` 자체가 생기지 않는다
 *   ④ 설치 기록이 없으면 무엇이 기본인지 모르므로 만들지 않는다
 *
 * **스킬 이름을 박지 않는다** — 설치 결과에서 고른다. 이름을 박으면 카탈로그가 바뀌는 순간
 * 이 파일이 조용히 아무것도 재지 않는다(전례 = `scenario-dev-method-skills` 의 26일 red).
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderBundledSkill } from "../src/codex/skills.js";
import { CONTINUOUS_SKILLS } from "../src/external-assets.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";
import {
  expectedSkillRelFiles,
  installedSkillIdWithReferences,
} from "./helpers/bundled-skill-dir.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const AGENTS_SKILLS = ".agents/skills";

/** 공유 자리를 쓰는 세 CLI. */
const SLOT_CLIS: ReadonlyArray<CliBase> = ["codex", "opencode", "antigravity"];

/** CLI 별 상시 스킬 안내(ADR-085)가 사는 앵커. codex · opencode 는 같은 `AGENTS.md` 다. */
const ANCHOR: Record<string, string> = {
  codex: "AGENTS.md",
  opencode: "AGENTS.md",
  antigravity: ".agents/rules/uzys-harness.md",
};

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agents-skills-slot-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
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

/** `update` 는 CLI 집합을 설치 로그에서 읽는다 — spec 의 cli 는 판정에 쓰이지 않는다. */
function update(cli: CliTargets): InstallReport {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "update",
    runExternal: null,
  });
}

function slot(id: string, rel = "SKILL.md"): string {
  return join(projectDir, AGENTS_SKILLS, id, rel);
}

function logOrThrow(): InstallLog {
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  return log;
}

/** 스킬 디렉터리의 파일별 내용 — 되살아난 판이 설치 직후 판과 바이트 동일한지 대조한다. */
function snapshot(id: string): Map<string, string> {
  const dir = join(projectDir, AGENTS_SKILLS, id);
  return new Map(listFilesRecursive(dir).map((rel) => [rel, readFileSync(join(dir, rel), "utf8")]));
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

/**
 * "하네스 구버전이 깔아 둔 상태" — 디스크를 옛 내용으로 바꾸고 **기준선도 그 해시로** 맞춘다.
 * 그래야 소유자 판정이 "사용자는 안 고쳤다"가 되어 백업 없이 최신판으로 덮이는 경로가 재현된다.
 */
function pretendHarnessOwned(rel: string, content: string): void {
  writeFileSync(join(projectDir, rel), content);
  const log = logOrThrow();
  writeInstallLog(projectDir, {
    ...log,
    externalFiles: (log.externalFiles ?? []).map((f) =>
      f.path === rel ? { path: rel, sha256: hashContent(content) } : f,
    ),
  });
}

function backupsUnder(dir: string): string[] {
  return listFilesRecursive(dir).filter((rel) => rel.includes(".backup-"));
}

function skillIdsAt(dir: string): string[] {
  const root = join(dir, AGENTS_SKILLS);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** 이 트랙 구성이 실제로 까는 번들 스킬 — 열거 사본을 두지 않으려고 설치 결과에서 유도한다. */
let INSTALLED_IDS: string[] = [];
/** 형제 파일(`references/`)을 가진 표본 — "디렉터리 전체가 도달한다"를 실제로 재게 한다. */
let WITH_REFS = "";
let probeDir: string;

beforeAll(() => {
  probeDir = mkdtempSync(join(tmpdir(), "agents-skills-slot-probe-"));
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: probeDir,
    spec: {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["codex"],
      projectDir: probeDir,
    },
    mode: "add",
    runExternal: null,
  });
  INSTALLED_IDS = skillIdsAt(probeDir);
  if (INSTALLED_IDS.length < 2) {
    throw new Error("tooling 설치가 번들 스킬을 2개 미만 깔았다 — 표본과 대조군을 못 가른다");
  }
  WITH_REFS = installedSkillIdWithReferences(HARNESS_ROOT, join(probeDir, AGENTS_SKILLS));
});

afterAll(() => {
  rmSync(probeDir, { recursive: true, force: true });
});

/** `id` 가 아닌 첫 설치 스킬 — 같은 실행에서 "판정기가 물었다"를 보이는 대조군. */
function otherThan(id: string): string {
  const other = INSTALLED_IDS.find((x) => x !== id);
  if (other === undefined) throw new Error("대조군으로 쓸 두 번째 스킬이 없다");
  return other;
}

/** 깔린 것 중 **상시 안내(ADR-085) 대상**인 첫 스킬 — 안내 축을 재려면 이게 필요하다. */
function continuousId(): string {
  const id = CONTINUOUS_SKILLS.map((s) => s.id).find((s) => INSTALLED_IDS.includes(s));
  if (id === undefined) {
    throw new Error("설치된 번들 스킬 중 상시 안내 대상이 없다 — 안내 축을 잴 수 없다");
  }
  return id;
}

/** 상시 안내의 항목 줄 (`renderContinuousSkillsNote` 의 형태). 이름만 찾으면 본문 언급에 걸린다. */
function noteLine(id: string): string {
  return `- \`${id}\` — `;
}

describe.each(SLOT_CLIS)("update — 새 번들 스킬이 공유 자리에 깔린다 (%s)", (cli) => {
  // claude 와 함께 깐 형태도 잰다 — 그때는 `.claude/skills/<id>` 가 있어 update 가 넘기는 목록에
  // 그 id 가 이미 들어 있다. 목록에 있어도 생성 허가가 없으면 refreshOnly 가 건너뛴다.
  const shapes: ReadonlyArray<[string, CliTargets]> = [
    ["단독", [cli]],
    ["claude 와 함께", ["claude", cli]],
  ];
  it.each(
    shapes,
  )("① (%s) 없는 `.agents/skills/<id>` 를 포팅판으로 만들고(형제 파일까지) 기록한다", (_, clis) => {
    install(clis);
    const id = WITH_REFS;
    const fresh = snapshot(id);
    pretendNewInThisRelease(id);
    expect(existsSync(join(projectDir, AGENTS_SKILLS, id))).toBe(false);

    const report = update(clis);

    // 본문 = 포팅판(`renderBundledSkill`) — Claude 원문(`/uzys:`)이 가면 이 CLI 에 없는 커맨드를 안내한다.
    const source = readFileSync(join(HARNESS_ROOT, "templates/skills", id, "SKILL.md"), "utf8");
    expect(readFileSync(slot(id), "utf8")).toBe(renderBundledSkill(source));
    // 형제 파일까지 — `SKILL.md` 만 오면 "references 를 읽어라"가 빈 자리를 가리킨다(#431).
    const rels = expectedSkillRelFiles(HARNESS_ROOT, id);
    expect(rels.length).toBeGreaterThan(1);
    for (const rel of rels) {
      expect(readFileSync(slot(id, rel), "utf8"), `${rel} 미도달 또는 설치 직후 판과 다름`).toBe(
        fresh.get(rel),
      );
    }
    // 기록 — 없으면 다음 update 가 이 파일들을 "판정 불가"로 보고 매번 백업을 쌓는다.
    const recorded = new Set((logOrThrow().externalFiles ?? []).map((f) => f.path));
    for (const rel of rels) expect(recorded).toContain(`${AGENTS_SKILLS}/${id}/${rel}`);
    // 새로 만든 것이므로 사용자 편집분 백업은 0.
    expect(report.updateMode?.externalBackedUp ?? []).toEqual([]);
    expect(backupsUnder(join(projectDir, AGENTS_SKILLS))).toEqual([]);
    // 고른 적 없는 CLI 의 자리를 경유하지 않았다.
    expect(existsSync(join(projectDir, ".claude"))).toBe(clis.includes("claude"));
  });

  it("② `--without <id>` 로 뺀 스킬은 update 가 되돌려 깔지 않는다 (#505)", () => {
    const dropped = INSTALLED_IDS[0] as string;
    const control = otherThan(dropped);
    install([cli], [dropped]);
    // 픽스처 자기검증 — 설치가 실제로 뺐어야 "update 가 되살리나"를 잴 수 있다.
    expect(existsSync(join(projectDir, AGENTS_SKILLS, dropped))).toBe(false);
    expect(logOrThrow().spec.skillExclude ?? []).toContain(dropped);
    // 대조군 — 빼지 않은 스킬 하나를 "새 릴리즈" 상태로 만든다. 이것이 돌아오면 이 실행에서
    // 생성 경로가 실제로 돌았다는 뜻이고, 그러면 `dropped` 의 부재는 제외 판정의 결과다.
    pretendNewInThisRelease(control);

    update([cli]);

    expect(existsSync(join(projectDir, AGENTS_SKILLS, dropped))).toBe(false);
    expect(existsSync(slot(control))).toBe(true);
  });

  it("④ 설치 기록이 없으면 만들지 않는다 — 무엇이 기본인지 모른다", () => {
    // 기록 없는 설치본에 update 가 닿는 형태 = `.claude/` 가 있는 레거시·클론(`.uzys-agent-harness/`
    // 는 무시 목록이라 클론에 없다). `.claude/` 도 기록도 없으면 update 자체가 거절한다.
    install(["claude", cli]);
    const id = INSTALLED_IDS[0] as string;
    const control = otherThan(id);
    pretendNewInThisRelease(id);
    // 대조군 — 다른 스킬을 옛 내용으로 두고, update 가 이 CLI 의 transform 을 실제로 돌렸는지 본다.
    // (로그가 없으니 기준선도 없다 → 판정 불가 → 보수적 백업과 함께 최신판으로 간다.)
    const controlFresh = readFileSync(slot(control), "utf8");
    writeFileSync(slot(control), "# v26.1.0 시절 스킬 본문\n");
    rmSync(installLogPath(projectDir));
    expect(readInstallLog(projectDir)).toBeNull(); // 전제

    update(["claude", cli]);

    expect(existsSync(join(projectDir, AGENTS_SKILLS, id))).toBe(false);
    expect(readFileSync(slot(control), "utf8")).toBe(controlFresh);
  });

  it("⑤ 새로 깐 상시 스킬이 그 CLI 앵커의 안내에 실린다 (ADR-085 · S6)", () => {
    install([cli]);
    const id = continuousId();
    const anchor = join(projectDir, ANCHOR[cli] as string);
    // 탐지기 자기검증 — 설치 직후 앵커에 이 형태의 줄이 있어야 아래 단언이 무엇을 재는지 성립한다.
    expect(readFileSync(anchor, "utf8")).toContain(noteLine(id));
    pretendNewInThisRelease(id);

    update([cli]);

    // 안내가 빠지면 설치자의 에이전트는 그 스킬을 영영 안 연다 — 깔린 것과 같은 무게의 축이다.
    expect(existsSync(slot(id))).toBe(true);
    expect(readFileSync(anchor, "utf8")).toContain(noteLine(id));
  });
});

describe("update — 안 고른 CLI 에는 만들지 않는다", () => {
  it("③ claude 단독 설치본에는 `.agents/` 가 생기지 않는다 — 세 CLI 가 집합에 없다", () => {
    install(["claude"]);
    expect(existsSync(join(projectDir, ".agents"))).toBe(false); // 전제
    const id = INSTALLED_IDS[0] as string;
    rmSync(join(projectDir, ".claude/skills", id), { recursive: true, force: true });

    update(["claude"]);

    expect(existsSync(join(projectDir, ".agents"))).toBe(false);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
    // 대조군 — claude 자리에는 #480 경로로 되돌아온다. 아무 일도 안 일어난 실행이 아니다.
    expect(existsSync(join(projectDir, ".claude/skills", id, "SKILL.md"))).toBe(true);
  });
});

describe("update — 세 CLI 가 함께 깔려도 공유 자리는 한 번만 쓰인다", () => {
  it("⑥ 한 번 생성 · 두 번째 update 백업 0 · `AGENTS.md` 최종 바이트 불변", () => {
    const all: CliTargets = ["codex", "opencode", "antigravity"];
    install(all);
    // 기준 실행 — 공유 자리에 할 일이 없을 때의 갱신 수. #550 이후 0 이지만 차이로 잰다 — 다른
    // 산출물의 갱신이 섞여도 이 단언이 공유 자리의 몫만 재게.
    const steady = update(all).updateMode?.externalUpdated ?? -1;
    const id = WITH_REFS;
    pretendNewInThisRelease(id);

    const first = update(all);
    const agentsMdAfterFirst = readFileSync(join(projectDir, "AGENTS.md"), "utf8");

    // 한 번 — 늘어난 갱신 수가 그 스킬의 파일 수와 같다. 셋이 각자 새로 썼다면 더 크고,
    // 한 CLI 도 못 만들었다면 0 이다.
    expect(existsSync(slot(id))).toBe(true);
    expect((first.updateMode?.externalUpdated ?? -1) - steady).toBe(
      expectedSkillRelFiles(HARNESS_ROOT, id).length,
    );
    expect(first.updateMode?.externalBackedUp ?? []).toEqual([]);

    const second = update(all);

    expect(second.updateMode?.externalBackedUp ?? []).toEqual([]);
    expect(backupsUnder(projectDir)).toEqual([]);
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toBe(agentsMdAfterFirst);
  });
});

describe("update — 기존 산출물 회귀 대조군", () => {
  it.each(SLOT_CLIS)("%s: 구버전 스킬 본문은 백업 없이 최신판으로 갱신된다", (cli) => {
    install([cli]);
    const id = INSTALLED_IDS[0] as string;
    const rel = `${AGENTS_SKILLS}/${id}/SKILL.md`;
    const fresh = readFileSync(join(projectDir, rel), "utf8");
    pretendHarnessOwned(rel, "# v26.1.0 시절 스킬 본문\n");

    const report = update([cli]);

    expect(readFileSync(join(projectDir, rel), "utf8")).toBe(fresh);
    expect(report.updateMode?.externalBackedUp ?? []).toEqual([]);
  });

  it("antigravity: 룰 파일(앵커) 옛 판은 백업 없이 최신판으로 갱신된다", () => {
    install(["antigravity"]);
    const rel = ANCHOR.antigravity as string;
    const fresh = readFileSync(join(projectDir, rel), "utf8");
    pretendHarnessOwned(rel, "# v26.1.0 시절 룰 파일\n");

    const report = update(["antigravity"]);

    expect(readFileSync(join(projectDir, rel), "utf8")).toBe(fresh);
    expect(report.updateMode?.externalBackedUp ?? []).toEqual([]);
  });
});
