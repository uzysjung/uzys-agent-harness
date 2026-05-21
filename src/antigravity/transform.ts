/**
 * Antigravity transform — v26.66.0.
 *
 * Google Antigravity 2.0 (I/O 2026-05-19) 공식 spec (codelabs):
 *   - Workspace skills:    .agents/skills/<name>/SKILL.md       (Anthropic skill format — codex 와 공유)
 *   - Workspace workflows: .agents/workflows/<name>.md          (`/<name>` 슬래시로 호출)
 *   - Workspace rules:     .agents/rules/                        (선택, 본 cycle 외)
 *   - Global rules:        ~/.gemini/GEMINI.md                   (D16 영역 — scope=global 시만)
 *   - Global skills:       ~/.gemini/antigravity/skills/         (D16 영역)
 *
 * 본 transform 의 책임:
 *   1. `.agents/skills/uzys-{phase}/SKILL.md` — codex 와 idempotent 공유 (Codex 도 같은 위치 write).
 *      cli=antigravity 만 켜고 codex 없으면 codex transform 미호출 → 본 함수가 책임.
 *   2. `.agents/workflows/uzys-{phase}.md` — Antigravity native workflow (신규).
 *      `/uzys:spec`, `/uzys:plan` ... 6-Gate 슬래시 매핑.
 *
 * SAFETY: `~/.gemini/` 글로벌 write 없음 (Phase C 별 cycle).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderSkill } from "../codex/skills.js";
import { ensureDir } from "../fs-ops.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"];

export interface AntigravityTransformParams {
  /** harness root (templates/commands/uzys/ source 위치). */
  harnessRoot: string;
  /** 사용자 프로젝트 root. `.agents/` 가 만들어질 위치. */
  projectDir: string;
  /**
   * v0.7.0+ — withUzysHarness gating. 6-Gate slash 의 antigravity native 매핑은
   * uzys-harness 활성 시에만 의미. uzys-harness OFF 면 skill/workflow 생성 X.
   */
  withUzysHarness: boolean;
}

export interface AntigravityTransformReport {
  /** 작성된 SKILL.md 경로 list (.agents/skills/uzys-{phase}/SKILL.md). */
  skillFiles: ReadonlyArray<string>;
  /** 작성된 workflow .md 경로 list (.agents/workflows/uzys-{phase}.md). */
  workflowFiles: ReadonlyArray<string>;
}

/**
 * Antigravity 용 project-scope 자산 생성.
 *
 * withUzysHarness=false: skipped (uzys-harness 슬래시 미사용 시 antigravity native 매핑 의미 X).
 */
export function runAntigravityTransform(
  params: AntigravityTransformParams,
): AntigravityTransformReport {
  const { harnessRoot, projectDir, withUzysHarness } = params;
  if (!withUzysHarness) {
    return { skillFiles: [], workflowFiles: [] };
  }

  const skillFiles: string[] = [];
  const workflowFiles: string[] = [];

  for (const phase of PHASES) {
    // 1. .agents/skills/uzys-{phase}/SKILL.md — codex 와 idempotent 공유.
    //    codex transform 도 같은 위치 write. cli=codex+antigravity 면 둘 다 호출되어
    //    덮어쓰기 (같은 내용 — 무해).
    const skillDir = join(projectDir, ".agents", "skills", `uzys-${phase}`);
    ensureDir(skillDir);
    const cmdSrc = join(harnessRoot, "templates/commands/uzys", `${phase}.md`);
    let source = "";
    if (existsSync(cmdSrc)) {
      source = readFileSync(cmdSrc, "utf8");
    } else {
      // Fallback: bundled stub from templates/codex/skills/<phase>/SKILL.md
      const fallback = join(harnessRoot, "templates/codex/skills", `uzys-${phase}/SKILL.md`);
      if (existsSync(fallback)) {
        source = readFileSync(fallback, "utf8");
      }
    }
    const skillTarget = join(skillDir, "SKILL.md");
    writeFileSync(skillTarget, renderSkill({ source, phase }));
    skillFiles.push(skillTarget);

    // 2. .agents/workflows/uzys-{phase}.md — Antigravity native workflow.
    //    `/uzys:spec` 등 슬래시로 호출. source 가 비어있으면 skip (commands/uzys/ 미설치).
    if (source) {
      const workflowDir = join(projectDir, ".agents", "workflows");
      ensureDir(workflowDir);
      const workflowTarget = join(workflowDir, `uzys-${phase}.md`);
      writeFileSync(workflowTarget, source);
      workflowFiles.push(workflowTarget);
    }
  }

  return { skillFiles, workflowFiles };
}
