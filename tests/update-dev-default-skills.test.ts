/**
 * #726 (ADR-105) — model-orchestration · external-model-consult · natural-korean 이 개발 트랙 기본이 됐다. 이 판보다
 * 앞선 설치본(그 세 스킬이 opt-in 이라 안 깔렸던 것)은 `update` 한 번으로 세 스킬을 받는다 — 새 규칙이 아니라 #480 ①
 * (`.claude/skills/` — `installNewSkillDirs`) · #530 S3(`.agents/skills/` — `agents-skill-targets`)의 기존 경로다. 둘 다
 * 누적 `excluded` 를 지킨다(ADR-099 R3). executive 계열 기록은 받지 않는다.
 *
 * "옛 판 설치본" 재현 = 지금 판으로 깐 뒤 세 스킬 디렉터리를 지우고 **기준선(skillFiles · externalFiles)에서도 뺀다**
 * (`agents-skills-slot.test.ts` 의 `pretendNewInThisRelease` 와 같은 논리). 기준선에 남기면 "깔았는데 사용자가 지웠다"가
 * 되어 되살림(`restored`) 경로를 재게 된다.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const THREE = ["model-orchestration", "external-model-consult", "natural-korean"] as const;

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "update-dev-default-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(tracks: Track[], cli: CliTargets, forceExclude: string[] = []): InstallSpec {
  return {
    tracks,
    options: { withCodexTrust: false },
    cli,
    projectDir,
    ...(forceExclude.length > 0 ? { userOverride: { forceInclude: [], forceExclude } } : {}),
  };
}

function run(mode: "add" | "update", s: InstallSpec): InstallReport {
  return runInstall({ harnessRoot: HARNESS_ROOT, projectDir, spec: s, mode, runExternal: null });
}

/** 주어진 스킬이 없던 옛 판 설치본처럼 만든다 — 디스크와 기준선 양쪽에서 뺀다. */
function pretendOlderRelease(ids: ReadonlyArray<string> = THREE): void {
  for (const id of ids) {
    for (const slot of [".claude/skills", ".agents/skills"]) {
      rmSync(join(projectDir, slot, id), { recursive: true, force: true });
    }
  }
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  const ours = (p: string): boolean =>
    ids.some((id) => p.startsWith(`${id}/`) || p.startsWith(`.agents/skills/${id}/`) || p === id);
  writeInstallLog(projectDir, {
    ...log,
    ...(log.skillFiles ? { skillFiles: log.skillFiles.filter((f) => !ours(f.path)) } : {}),
    ...(log.externalFiles ? { externalFiles: log.externalFiles.filter((f) => !ours(f.path)) } : {}),
  });
}

const added = (r: InstallReport): string[] => [
  ...(r.updateMode?.installedNew ?? []),
  ...(r.updateMode?.installedForTracks ?? []).map((e) => e.path),
];

describe("#726 — 개발 트랙 기존 설치본은 update 로 세 스킬을 받는다(두 자리 모두)", () => {
  it("tooling · claude + codex: .claude/skills 와 .agents/skills 양쪽에 세 스킬이 새로 깔린다", () => {
    run("add", spec(["tooling"], ["claude", "codex"]));
    pretendOlderRelease();
    for (const id of THREE) expect(existsSync(join(projectDir, ".claude/skills", id))).toBe(false);

    const report = run("update", spec(["tooling"], ["claude", "codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".claude/skills", id, "SKILL.md")), id).toBe(true);
      expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md")), id).toBe(true);
      expect(added(report), id).toEqual(
        expect.arrayContaining([`.claude/skills/${id}`, `.agents/skills/${id}`]),
      );
    }
  });

  it("codex 단독 설치본도 .agents/skills 에 받는다 (Claude 밖 CLI 의 비대칭은 없다)", () => {
    run("add", spec(["tooling"], ["codex"]));
    pretendOlderRelease();
    run("update", spec(["tooling"], ["codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md")), id).toBe(true);
    }
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("executive 기록은 받지 않는다", () => {
    run("add", spec(["executive"], ["claude", "codex"]));
    const report = run("update", spec(["executive"], ["claude", "codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".claude/skills", id)), id).toBe(false);
      expect(existsSync(join(projectDir, ".agents/skills", id)), id).toBe(false);
    }
    expect(added(report).filter((p) => THREE.some((id) => p.endsWith(id)))).toEqual([]);
  });

  it("`--without natural-korean` 으로 뺀 설치본은 그것만 받지 않는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"], ["natural-korean"]));
    pretendOlderRelease();
    run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      expect(existsSync(join(projectDir, slot, "natural-korean")), slot).toBe(false);
      expect(existsSync(join(projectDir, slot, "model-orchestration")), slot).toBe(true);
      expect(existsSync(join(projectDir, slot, "external-model-consult")), slot).toBe(true);
    }
  });
});

/**
 * #729 (ADR-109) — multi-model-debate 가 개발 트랙 기본으로 들어왔다. 같은 두 경로(#480 ① · #530 S3)로 옛 설치본이
 * `update` 한 번에 받는다 — 사이드카(references/ · agents/openai.yaml)까지 두 자리에. 브라우저 위임 3종은 opt-in 이라
 * 기록에 없으면 `update` 가 깔지 않는다.
 */
describe("#729 — multi-model-debate 는 update 로 두 자리에 오고, 브라우저 위임 3종은 오지 않는다", () => {
  const DEBATE = ["multi-model-debate"] as const;
  const BROWSER = ["gemini-delegate", "chatgpt-delegate", "genspark-delegate"] as const;
  const SIDECARS = ["SKILL.md", "references/adapters.md", "agents/openai.yaml"] as const;

  it("tooling · claude + codex: 옛 설치본이 사이드카까지 두 자리에 받는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"]));
    pretendOlderRelease(DEBATE);
    expect(existsSync(join(projectDir, ".claude/skills/multi-model-debate"))).toBe(false);

    const report = run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      for (const f of SIDECARS) {
        expect(existsSync(join(projectDir, slot, "multi-model-debate", f)), `${slot} ${f}`).toBe(
          true,
        );
      }
      for (const id of BROWSER) {
        expect(existsSync(join(projectDir, slot, id)), `${slot} ${id}`).toBe(false);
      }
    }
    expect(added(report)).toEqual(
      expect.arrayContaining([
        ".claude/skills/multi-model-debate",
        ".agents/skills/multi-model-debate",
      ]),
    );
  });

  it("`--without multi-model-debate` 로 뺀 설치본은 받지 않는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"], ["multi-model-debate"]));
    pretendOlderRelease(DEBATE);
    run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      expect(existsSync(join(projectDir, slot, "multi-model-debate")), slot).toBe(false);
    }
  });

  it("--with 로 고른 브라우저 위임 스킬은 두 자리에 깔린다(opt-in 경로)", () => {
    run("add", {
      ...spec(["tooling"], ["claude", "codex"]),
      userOverride: { forceInclude: [...BROWSER], forceExclude: [] },
    });
    for (const slot of [".claude/skills", ".agents/skills"]) {
      for (const id of BROWSER) {
        expect(existsSync(join(projectDir, slot, id, "SKILL.md")), `${slot} ${id}`).toBe(true);
      }
    }
  });
});
