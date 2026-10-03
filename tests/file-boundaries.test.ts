/**
 * #628/#620/#643/#614 — 파일 경계(F 클러스터).
 *
 * - #628: 마커가 한쪽만 있거나 복제된 CLAUDE.md 에서 uninstall 이 @import 를 남기지 않고
 *   허위 "removed" 보고도 하지 않는다.
 * - #620: 블록 앞 사용자 빈 줄이 흡수되지 않는다(설치가 넣은 빈 줄 하나만 되돌린다) ·
 *   파일 끝 개행 상태를 보존한다.
 * - #643: 스켈리톤이 모르는 상위 절(## My Team Conventions)이 update 에서 사라지지 않는다.
 * - #614: --reinstall 이 파손 JSON settings.json 을 백업 후 새로 쓴다(훅 배선 복구).
 */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import { stripHarnessImport } from "../src/project-claude-merge.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-bound-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const install = (clis: ReadonlyArray<CliBase>, mode?: string) =>
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: mode as never,
    spec: {
      tracks: ["base"],
      options: { withCodexTrust: false },
      cli: [...clis],
      projectDir,
    } as InstallSpec,
  });

describe("#628/#620 — stripHarnessImport 경계", () => {
  const BODY = "# title\n\nintro\n";
  const withBlock = `${BODY}\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n`;

  it("정상 블록: 본문이 그대로 돌아온다", () => {
    expect(stripHarnessImport(withBlock)).toBe(BODY);
  });

  it("start 마커만 있어도 import 참조를 남기지 않는다", () => {
    const broken = `${BODY}\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n`;
    const out = stripHarnessImport(broken);
    expect(out).not.toBeNull();
    expect(out as string).not.toContain("@CLAUDE-uzys-harness.md");
    expect(out as string).toContain("intro");
  });

  it("end 마커만 있어도 정리한다", () => {
    const broken = `${BODY}\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n`;
    expect(stripHarnessImport(broken)).not.toContain("@CLAUDE-uzys-harness.md");
  });

  it("복제 블록: 두 벌 다 걷는다", () => {
    const doubled = `${BODY}\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n`;
    expect(stripHarnessImport(doubled)).toBe(BODY);
  });

  it("#620 — 사용자 빈 줄 두 개가 흡수되지 않는다", () => {
    const two = `${BODY}\n\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n`;
    const out = stripHarnessImport(two) as string;
    // 설치가 넣은 빈 줄 하나만 되돌린다 — 사용자의 여분 빈 줄은 생존
    expect(out).toMatch(/intro\n\n$/);
  });

  it("#620 — 파일 끝 개행 없음 상태를 보존한다", () => {
    const noNl = `${BODY}\n<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->`;
    const out = stripHarnessImport(noNl) as string;
    expect(out.endsWith("\n")).toBe(false);
    expect(out).toContain("intro");
  });

  it("마커 없는 파일은 null (기존 계약)", () => {
    expect(stripHarnessImport(BODY)).toBeNull();
  });
});

describe("#643 — 모르는 상위 절 보존", () => {
  it("update 후에도 ## My Team Conventions 가 산다", () => {
    install(["codex"]);
    const p = join(projectDir, "AGENTS.md");
    const before = readFileSync(p, "utf8");
    writeFileSync(p, `${before}\n## My Team Conventions\n- line1\n`, "utf8");
    runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT);
    const after = readFileSync(p, "utf8");
    expect(after).toContain("## My Team Conventions");
    expect(after).toContain("- line1");
    expect(after.match(/^## My Team Conventions$/gm)?.length).toBe(1);
  });
});

describe("#614 — reinstall 이 파손 settings.json 을 고친다", () => {
  it("백업 후 새로 써서 훅이 배선된다", () => {
    install(["claude"]);
    const settingsPath = join(projectDir, ".claude", "settings.json");
    writeFileSync(settingsPath, "{broken json,,,");
    install(["claude"], "reinstall");
    const after = JSON.parse(readFileSync(settingsPath, "utf8")) as {
      hooks?: Record<string, unknown>;
    };
    expect(after.hooks?.SessionStart).toBeTruthy();
    // 원본 파손분은 백업에 보존
    const backup = join(projectDir, ".claude", "settings.json.backup-");
    void backup;
    const found = readdirSync(join(projectDir, ".claude")).filter((f) =>
      f.startsWith("settings.json.backup-"),
    );
    expect(found.length).toBe(1);
    expect(readFileSync(join(projectDir, ".claude", found[0] ?? ""), "utf8")).toBe(
      "{broken json,,,",
    );
  });
});
