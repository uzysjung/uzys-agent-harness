/**
 * Antigravity transform — v26.66.0 (skills/workflows) + v26.69.0 (rules).
 *
 * Google Antigravity 2.0 (I/O 2026-05-19) 공식 spec (codelabs):
 *   - Workspace skills:    .agents/skills/<name>/SKILL.md       (Anthropic skill format — codex 와 공유)
 *   - Workspace workflows: .agents/workflows/<name>.md          (`/<name>` 슬래시로 호출)
 *   - Workspace rules:     .agents/rules/<name>.md              (디렉토리, plain markdown)
 *   - Global rules:        ~/.gemini/GEMINI.md                   (사용자 글로벌 — harness 미터치)
 *   - Global skills:       ~/.gemini/antigravity/skills/         (Phase C opt-in — antigravity/opt-in.ts)
 *
 * 본 transform 의 책임 (모두 project-scope):
 *   1. `.agents/rules/uzys-harness.md` — project context (CLAUDE.md → Antigravity rule).
 *      **withUzysHarness 무관 — 항상 작성** (CLAUDE.md/AGENTS.md 처럼 foundational context).
 *      cli=antigravity 단독 선택 시 이게 없으면 Antigravity 가 프로젝트 컨벤션을 모름.
 *   2. `.agents/skills/uzys-{phase}/SKILL.md` — codex 와 idempotent 공유. withUzysHarness 시만.
 *   3. `.agents/workflows/uzys-{phase}.md` — Antigravity native workflow. withUzysHarness 시만.
 *      파일명 기반 `/uzys-{phase}` 호출 → body 의 `/uzys:` 참조도 `/uzys-` 로 rename (정합).
 *
 * SAFETY: `~/.gemini/` 글로벌 write 없음 (Phase C 의 opt-in.ts 가 별도 담당).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { renameSlashes, renderAgentsMd } from "../codex/agents-md.js";
import { renderSkill } from "../codex/skills.js";
import { ensureDir } from "../fs-ops.js";

const PHASES = ["spec", "plan", "build", "test", "review", "ship"];

export interface AntigravityTransformParams {
  /** harness root (templates/CLAUDE.md + templates/commands/uzys/ source 위치). */
  harnessRoot: string;
  /** 사용자 프로젝트 root. `.agents/` 가 만들어질 위치. */
  projectDir: string;
  /**
   * withUzysHarness gating. 6-Gate skills/workflows 의 antigravity native 매핑은
   * uzys-harness 활성 시에만. rules (project context) 는 본 flag 무관 — 항상 작성.
   */
  withUzysHarness: boolean;
}

export interface AntigravityTransformReport {
  /** v26.69.0 — 작성된 rules 파일 경로 (.agents/rules/uzys-harness.md). null = template 부재. */
  rulesFile: string | null;
  /** 작성된 SKILL.md 경로 list (.agents/skills/uzys-{phase}/SKILL.md). */
  skillFiles: ReadonlyArray<string>;
  /** 작성된 workflow .md 경로 list (.agents/workflows/uzys-{phase}.md). */
  workflowFiles: ReadonlyArray<string>;
}

/**
 * Antigravity 용 project-scope 자산 생성.
 *
 * rules 는 항상 (cli=antigravity 시), skills/workflows 는 withUzysHarness 시만.
 */
export function runAntigravityTransform(
  params: AntigravityTransformParams,
): AntigravityTransformReport {
  const { harnessRoot, projectDir, withUzysHarness } = params;

  // 1. .agents/rules/uzys-harness.md — project context. withUzysHarness 무관 (항상).
  const rulesFile = writeRules(harnessRoot, projectDir);

  const skillFiles: string[] = [];
  const workflowFiles: string[] = [];

  if (withUzysHarness) {
    for (const phase of PHASES) {
      // 2. .agents/skills/uzys-{phase}/SKILL.md — codex 와 idempotent 공유.
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

      // 3. .agents/workflows/uzys-{phase}.md — Antigravity native workflow.
      //    파일명 기반 `/uzys-{phase}` 호출 → body 의 `/uzys:` 참조도 `/uzys-` 로 rename (정합).
      //    source 가 비어있으면 skip (commands/uzys/ 미설치).
      if (source) {
        const workflowDir = join(projectDir, ".agents", "workflows");
        ensureDir(workflowDir);
        const workflowTarget = join(workflowDir, `uzys-${phase}.md`);
        writeFileSync(workflowTarget, renameSlashes(source));
        workflowFiles.push(workflowTarget);
      }
    }
  }

  return { rulesFile, skillFiles, workflowFiles };
}

/**
 * v26.69.0 — `.agents/rules/uzys-harness.md` 작성. CLAUDE.md → Antigravity workspace rule.
 *
 * Source: templates/CLAUDE.md (전문) + templates/antigravity/AGENTS.md.template.
 * v26.70.0 — renderAgentsMd 재사용 (codex/opencode 와 동일 전문 embed). `{PROJECT_RULES}` 에
 * CLAUDE.md 본문 전체 삽입 + `/uzys:` → `/uzys-` rename.
 *
 * template 또는 CLAUDE.md 부재 시 null (graceful — install 진행).
 */
function writeRules(harnessRoot: string, projectDir: string): string | null {
  const claudeMdPath = join(harnessRoot, "templates/CLAUDE.md");
  const templatePath = join(harnessRoot, "templates/antigravity/AGENTS.md.template");
  if (!existsSync(claudeMdPath) || !existsSync(templatePath)) {
    return null;
  }
  const claudeMd = readFileSync(claudeMdPath, "utf8");
  const template = readFileSync(templatePath, "utf8");
  const rulesDir = join(projectDir, ".agents", "rules");
  ensureDir(rulesDir);
  const target = join(rulesDir, "uzys-harness.md");
  writeFileSync(target, renderAgentsMd({ template, claudeMd, projectName: basename(projectDir) }));
  return target;
}
