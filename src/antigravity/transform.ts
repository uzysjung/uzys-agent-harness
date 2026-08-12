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
import { portRules } from "../rules-port.js";

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
  /** 2026-08-12 — 이 설치의 배포 룰 이름들. `.agents/rules/<name>.md` 로 나간다. */
  rules?: ReadonlyArray<string>;
  /**
   * v26.133.0 (ADR-048) — 설치 시점 기준선 (install log `externalFiles`).
   * codex/opencode 와 같은 이유로 **required**. 레거시는 빈 Map 을 명시적으로 넘긴다.
   */
  baseline: ReadonlyMap<string, string>;
  /**
   * v26.134.0 (ADR-049) — `update` 경로. 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다.
   * antigravity 를 안 깐 프로젝트에서 돌려도 `.agents/rules/` 가 생기지 않는다.
   */
  refreshOnly?: boolean;
}

export interface AntigravityTransformReport {
  /** v26.69.0 — 작성된 **앵커** 파일 경로 (.agents/rules/uzys-harness.md). null = template 부재. */
  rulesFile: string | null;
  /** 2026-08-12 — 작성된 배포 룰 경로 (.agents/rules/<name>.md). 앵커와 형제. */
  harnessRuleFiles: string[];
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
  const {
    harnessRoot,
    projectDir,
    selectedInternalSkills = [],
    rules = [],
    baseline,
    refreshOnly,
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, { refreshOnly: refreshOnly ?? false });

  // 1. .agents/rules/uzys-harness.md — project context (CLAUDE.md → Antigravity rule, 항상).
  const rulesFile = writeRules(harnessRoot, projectDir, writer);

  // 1a. 2026-08-12 — 배포 룰을 같은 워크스페이스 룰 디렉터리에 형제 파일로 놓는다.
  //   Antigravity 는 `.agents/rules/*.md` 를 네이티브로 읽으므로 변환이 필요 없다(파일당 12,000자
  //   상한 — 배포 룰은 전부 그 아래다). 위 `uzys-harness.md` 는 이름과 달리 **앵커**라서,
  //   그것만으로는 룰이 도달하지 않았다.
  const harnessRuleFiles: string[] = [];
  for (const rule of portRules(harnessRoot, rules)) {
    const target = join(projectDir, ".agents", "rules", `${rule.name}.md`);
    if (!writer.write(target, `${rule.body}\n`)) continue;
    harnessRuleFiles.push(target);
  }

  const skillFiles: string[] = [];

  // 1b. v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (frontmatter 보존).
  //   renderBundledSkill 이 source frontmatter(name: <id>)를 보존.
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const target = join(projectDir, ".agents", "skills", id, "SKILL.md");
    // 건너뛴 경로를 report 에 실으면 "깔았다"는 거짓 보고가 된다.
    if (!writer.write(target, renderBundledSkill(readFileSync(src, "utf8")))) continue;
    skillFiles.push(target);
  }

  return {
    rulesFile,
    harnessRuleFiles,
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
  // refresh 모드가 건너뛰면 null — 안 만든 파일을 만들었다고 보고하지 않는다.
  return writer.write(target, rulesOut) ? target : null;
}
