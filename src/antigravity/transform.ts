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

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { renderAgentsMd } from "../codex/agents-md.js";
import { renderBundledSkill } from "../codex/skills.js";
import { createOwnedWriter, type OwnedWriteResult, type OwnedWriter } from "../owned-write.js";
import { renderFillScaffold } from "../project-claude-merge.js";

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
  /**
   * v26.133.0 (ADR-048) — 설치 시점 기준선 (install log `externalFiles`).
   * codex/opencode 와 같은 이유로 **required**. 레거시는 빈 Map 을 명시적으로 넘긴다.
   */
  baseline: ReadonlyMap<string, string>;
}

export interface AntigravityTransformReport {
  /** v26.69.0 — 작성된 rules 파일 경로 (.agents/rules/uzys-harness.md). null = template 부재. */
  rulesFile: string | null;
  /** 작성된 SKILL.md 경로 list (.agents/skills/<id>/SKILL.md). */
  skillFiles: ReadonlyArray<string>;
  /** v26.133.0 (ADR-048) — 소유권 결과 (기준선 · 백업된 사용자 편집분). */
  ownership: OwnedWriteResult;
}

/**
 * Antigravity 용 project-scope 자산 생성 (rules + dev-method skills).
 */
export function runAntigravityTransform(
  params: AntigravityTransformParams,
): AntigravityTransformReport {
  const { harnessRoot, projectDir, selectedInternalSkills = [], baseline } = params;
  const writer = createOwnedWriter(projectDir, baseline);

  // 1. .agents/rules/uzys-harness.md — project context (CLAUDE.md → Antigravity rule, 항상).
  const rulesFile = writeRules(harnessRoot, projectDir, writer);

  const skillFiles: string[] = [];

  // 1b. v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (frontmatter 보존).
  //   renderBundledSkill 이 source frontmatter(name: <id>)를 보존.
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const target = join(projectDir, ".agents", "skills", id, "SKILL.md");
    writer.write(target, renderBundledSkill(readFileSync(src, "utf8")));
    skillFiles.push(target);
  }

  return {
    rulesFile,
    skillFiles,
    ownership: writer.result(),
  };
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
function writeRules(harnessRoot: string, projectDir: string, writer: OwnedWriter): string | null {
  const claudeMdPath = join(harnessRoot, "templates/CLAUDE.md");
  const templatePath = join(harnessRoot, "templates/antigravity/AGENTS.md.template");
  if (!existsSync(claudeMdPath) || !existsSync(templatePath)) {
    return null;
  }
  const claudeMd = readFileSync(claudeMdPath, "utf8");
  const template = readFileSync(templatePath, "utf8");
  const target = join(projectDir, ".agents", "rules", "uzys-harness.md");
  const rulesOut = renderAgentsMd({
    template,
    claudeMd,
    projectName: basename(projectDir),
    projectContext: renderFillScaffold(),
  });
  // 사용자가 채운 rules 파일을 재설치(add 모드) 덮어쓰기 전 보존 — 루트 CLAUDE.md 와 대칭.
  // v26.133.0 (ADR-048) — 내용 비교에서 소유자 판정으로 (릴리즈마다 백업 쌓임 방지).
  writer.write(target, rulesOut);
  return target;
}
