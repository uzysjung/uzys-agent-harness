/**
 * Antigravity global opt-in — v26.67.0 (Phase C).
 *
 * `~/.gemini/antigravity/skills/uzys-{phase}/` + `~/.gemini/antigravity/global_workflows/uzys-{phase}.md`
 * 복사. D16 영역 — `scope=global` + `cli.includes("antigravity")` + `withAntigravityGlobal=true`
 * 세 조건 모두 충족 시에만 호출.
 *
 * Codex `runCodexOptIn` 패턴 미러 (D16 동일 보호).
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { renameSlashes } from "../codex/agents-md.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"];

export interface AntigravityOptInReport {
  /** `~/.gemini/antigravity/skills/uzys-<phase>/` 복사 결과 */
  skillsInstalled: {
    enabled: boolean;
    count: number;
    targetDir: string;
  };
  /** `~/.gemini/antigravity/global_workflows/uzys-<phase>.md` 복사 결과 */
  workflowsInstalled: {
    enabled: boolean;
    count: number;
    targetDir: string;
  };
}

export interface AntigravityOptInContext {
  /** 사용자 프로젝트 root (`.agents/skills/uzys-*` source). */
  projectDir: string;
  /** harness root (templates/commands/uzys/ source — workflow body 원본). */
  harnessRoot?: string;
  /** 글로벌 `~/.gemini/` 경로 (테스트 override 가능). */
  geminiHome?: string;
  /** `withAntigravityGlobal` opt-in flag. false 시 전체 skip. */
  enabled: boolean;
}

/**
 * Antigravity 글로벌 opt-in 실행. `enabled=false` 시 skip + empty report.
 */
export function runAntigravityOptIn(ctx: AntigravityOptInContext): AntigravityOptInReport {
  const geminiHome = ctx.geminiHome ?? join(homedir(), ".gemini");
  const skillsTarget = join(geminiHome, "antigravity", "skills");
  const workflowsTarget = join(geminiHome, "antigravity", "global_workflows");

  if (!ctx.enabled) {
    return {
      skillsInstalled: { enabled: false, count: 0, targetDir: skillsTarget },
      workflowsInstalled: { enabled: false, count: 0, targetDir: workflowsTarget },
    };
  }

  // 1. ~/.gemini/antigravity/skills/uzys-{phase}/ 복사
  //    Source: projectDir/.agents/skills/uzys-{phase}/  (Phase B 가 만든 산출).
  //    Antigravity 가 .agents/skills/ 와 ~/.gemini/antigravity/skills/ 둘 다 native 인식 →
  //    같은 내용을 global 위치에도 복사 (모든 프로젝트에서 보이도록).
  let skillsCount = 0;
  for (const phase of PHASES) {
    const src = join(ctx.projectDir, ".agents", "skills", `uzys-${phase}`);
    if (!existsSync(src)) continue;
    const dst = join(skillsTarget, `uzys-${phase}`);
    mkdirSync(dst, { recursive: true });
    cpSync(src, dst, { recursive: true });
    skillsCount++;
  }

  // 2. ~/.gemini/antigravity/global_workflows/uzys-{phase}.md 복사
  //    Source: harnessRoot/templates/commands/uzys/<phase>.md
  let workflowsCount = 0;
  if (ctx.harnessRoot) {
    mkdirSync(workflowsTarget, { recursive: true });
    for (const phase of PHASES) {
      const src = join(ctx.harnessRoot, "templates/commands/uzys", `${phase}.md`);
      if (!existsSync(src)) continue;
      // Antigravity 파일명 기반 `/uzys-{phase}` dispatch → body 내 `/uzys:` cross-ref 도
      // `/uzys-` 로 rename (project-scope transform.ts:94 와 동일 정합).
      const body = renameSlashes(readFileSync(src, "utf8"));
      const dst = join(workflowsTarget, `uzys-${phase}.md`);
      writeFileSync(dst, body);
      workflowsCount++;
    }
  }

  return {
    skillsInstalled: { enabled: true, count: skillsCount, targetDir: skillsTarget },
    workflowsInstalled: { enabled: true, count: workflowsCount, targetDir: workflowsTarget },
  };
}
