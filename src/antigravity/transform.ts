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
 *      foundational context (CLAUDE.md/AGENTS.md 처럼 항상 작성).
 *      cli=antigravity 단독 선택 시 이게 없으면 Antigravity 가 프로젝트 컨벤션을 모름.
 *   2. `.agents/skills/<id>/SKILL.md` — dev-method skills (frontmatter 보존, codex 와 공유).
 *
 * SAFETY: `~/.gemini/` 글로벌 write 없음.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { renderAgentsMd } from "../codex/agents-md.js";
import { renderBundledSkill } from "../codex/skills.js";
import { ensureDir } from "../fs-ops.js";

export interface AntigravityTransformParams {
  /** harness root (templates/CLAUDE.md source 위치). */
  harnessRoot: string;
  /** 사용자 프로젝트 root. `.agents/` 가 만들어질 위치. */
  projectDir: string;
  /**
   * v26.87.0 — dev-method skill ids 선택 목록. 각 id 의 `templates/skills/<id>/SKILL.md` 를
   * Antigravity native `.agents/skills/<id>/SKILL.md` 로 (frontmatter 보존) 출력.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
}

export interface AntigravityTransformReport {
  /** v26.69.0 — 작성된 rules 파일 경로 (.agents/rules/uzys-harness.md). null = template 부재. */
  rulesFile: string | null;
  /** 작성된 SKILL.md 경로 list (.agents/skills/<id>/SKILL.md). */
  skillFiles: ReadonlyArray<string>;
}

/**
 * Antigravity 용 project-scope 자산 생성 (rules + dev-method skills).
 */
export function runAntigravityTransform(
  params: AntigravityTransformParams,
): AntigravityTransformReport {
  const { harnessRoot, projectDir, selectedInternalSkills = [] } = params;

  // 1. .agents/rules/uzys-harness.md — project context (CLAUDE.md → Antigravity rule, 항상).
  const rulesFile = writeRules(harnessRoot, projectDir);

  const skillFiles: string[] = [];

  // 1b. v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (frontmatter 보존).
  //   renderBundledSkill 이 source frontmatter(name: <id>)를 보존.
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const skillDir = join(projectDir, ".agents", "skills", id);
    ensureDir(skillDir);
    const target = join(skillDir, "SKILL.md");
    writeFileSync(target, renderBundledSkill(readFileSync(src, "utf8")));
    skillFiles.push(target);
  }

  return { rulesFile, skillFiles };
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
