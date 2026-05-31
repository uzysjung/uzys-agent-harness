/**
 * AGENTS.md transform — CLAUDE.md → AGENTS.md.
 *
 * v26.70.0 — section 추출(Identity/Direction/Principles) → CLAUDE.md **전문 embed**.
 *   실 `templates/CLAUDE.md` 가 Rule 1~12 구조라 Identity/Direction/Principles 헤딩이 없어
 *   extractSection 이 빈 결과 → AGENTS.md 가 빈 섹션으로 shipping 되던 버그 fix.
 *   `{PROJECT_RULES}` placeholder 에 CLAUDE.md 본문 전체를 삽입 (heading 구조 의존 0).
 */

/** Rename Claude slash conventions (`/uzys:foo`) to Codex (`/uzys-foo`). */
export function renameSlashes(text: string): string {
  return text.replaceAll("/uzys:", "/uzys-");
}

export interface AgentsMdParams {
  template: string;
  claudeMd: string;
  projectName: string;
}

/**
 * Render AGENTS.md by embedding the full CLAUDE.md body into the template.
 *
 * Placeholders:
 *   - {PROJECT_NAME} — basename of project dir
 *   - {PROJECT_RULES} — full CLAUDE.md body (first h1 stripped; template provides its own h1)
 *
 * 마지막에 `/uzys:` → `/uzys-` rename (Codex/Antigravity 는 slash namespace 미지원).
 */
export function renderAgentsMd(params: AgentsMdParams): string {
  // CLAUDE.md 의 첫 h1 (# title) 제거 — 템플릿이 자체 h1 보유.
  const body = params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
  const replaced = params.template
    .replaceAll("{PROJECT_NAME}", params.projectName)
    .replaceAll("{PROJECT_RULES}", body);
  return renameSlashes(replaced);
}
