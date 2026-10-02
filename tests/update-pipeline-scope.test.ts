/**
 * #601/#603/#597/#639 — update 파이프라인의 스코프·갱신·고지.
 *
 * - #601: update 가 설치된 트랙 밖의 룰(cli-development)을 AGENTS.md/.agents/rules 에
 *   새로 만들지 않는다 — install 과 같은 resolveRules SSOT.
 * - #603: install 도 settings.json 의 죽은 훅 참조를 지운다(USAGE L148 "both").
 * - #597: update 가 CLI 중립 헬퍼(.uzys-agent-harness/*.sh)를 현재 판으로 갱신 —
 *   기록 sha 그대로면 백업 없이, 사용자가 고쳤으면 백업 후.
 * - #639: 개명·은퇴 스킬 안내가 .agents/skills(비-Claude 슬롯)도 훑는다.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-scope-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function install(clis: ReadonlyArray<CliBase>): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: ["data"],
      options: { withCodexTrust: false },
      cli: [...clis],
      projectDir,
    } satisfies InstallSpec,
  });
}

describe("#601 — update 가 트랙 밖 룰을 만들지 않는다", () => {
  it("data 트랙(룰 5종) 설치에서 update 후에도 cli-development 가 없다", () => {
    install(["codex"]);
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8");
    expect(agents).not.toContain("Shell Safety");
    runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).not.toContain("Shell Safety");
    expect(existsSync(join(projectDir, ".agents/rules/cli-development.md"))).toBe(false);
  });
});

describe("#603 — install 이 죽은 훅 참조를 지운다", () => {
  it("스크립트 없는 참조를 지우고 보고한다", () => {
    install(["claude"]);
    const settingsPath = join(projectDir, ".claude", "settings.json");
    const settings = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string; type: string }> }>>;
    };
    settings.hooks.PreToolUse = [
      { hooks: [{ command: "$CLAUDE_PROJECT_DIR/.claude/hooks/ghost.sh", type: "command" }] },
    ];
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["data"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      } satisfies InstallSpec,
    });
    const after = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    expect(JSON.stringify(after.hooks)).not.toContain("ghost.sh");
    expect(report.staleHookRefs ?? []).toContain("hooks/ghost.sh");
  });
});

describe("#597 — update 가 CLI 중립 헬퍼를 갱신한다", () => {
  it("옛 판으로 둔 헬퍼를 최신판으로 되돌리고 사용자 편집분은 백업에 보존한다", () => {
    install(["claude"]);
    const helper = join(projectDir, ".uzys-agent-harness", "check-absence.sh");
    const fresh = readFileSync(helper, "utf8"); // 방금 설치된 최신판 = 기대값
    writeFileSync(helper, `${fresh}\n# OLD RELEASE LINE\n`, "utf8"); // 옛 판 시뮬레이션
    runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    const after = readFileSync(helper, "utf8");
    expect(after).toBe(fresh); // 최신판으로 교체
    expect(after).not.toContain("# OLD RELEASE LINE");
    // 편집분(기록 sha 와 다른 디스크)은 옆에 보존 — L185-193
    const backups = readdirSync(join(projectDir, ".uzys-agent-harness")).filter((f) =>
      f.startsWith("check-absence.sh.backup-"),
    );
    expect(backups.length).toBe(1);
    const first = backups[0];
    expect(first).toBeDefined();
    expect(
      readFileSync(join(projectDir, ".uzys-agent-harness", first as string), "utf8"),
    ).toContain("# OLD RELEASE LINE");
  });

  it("결측 헬퍼는 0단계 installNewAssets(#283) 가 채운다 — 이 PR 의 갱신 단계와 경계가 다르다", () => {
    install(["claude"]);
    rmSync(join(projectDir, ".uzys-agent-harness", "check-absence.sh"), { force: true });
    runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    // 결측 = #283 경로가 설치한다 (update 가 공유 파일을 안 만드는 ADR-049 와 다른, 헬퍼의 기존 계약)
    expect(existsSync(join(projectDir, ".uzys-agent-harness", "check-absence.sh"))).toBe(true);
  });
});

describe("#639 — 은퇴 스킬 안내가 공유 슬롯을 훑는다", () => {
  it(".agents/skills 의 은퇴 스킬이 보고에 오른다", () => {
    install(["codex"]); // .agents/skills 슬롯
    const slot = join(projectDir, ".agents", "skills", "verification-loop");
    mkdirSync(slot, { recursive: true });
    writeFileSync(join(slot, "SKILL.md"), "---\nname: verification-loop\n---\n", "utf8");
    const report = runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    expect(report.externalSkillsNotInCatalog).toContain("verification-loop");
  });
});
