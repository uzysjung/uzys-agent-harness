/**
 * AGENTS.md transform — CLAUDE.md → AGENTS.md (OpenCode flavor).
 *
 * Mirrors `src/codex/agents-md.ts` logic (Codex와 OpenCode 둘 다 콜론 namespace
 * 미사용으로 slash rename 동일). 별도 파일로 유지 — 모듈 독립성.
 *
 * v26.70.0 — section 추출 → CLAUDE.md 전문 embed (`{PROJECT_RULES}`). codex/agents-md 와 동일 fix.
 */

/** Rename Claude slash conventions (`/uzys:foo`) to OpenCode (`/uzys-foo`). */
export function renameSlashes(text: string): string {
  return text.replaceAll("/uzys:", "/uzys-");
}

export interface AgentsMdParams {
  template: string;
  claudeMd: string;
  projectName: string;
  /** Project-context fill scaffold — the same body shipped to the Claude Code CLAUDE.md. */
  projectContext: string;
  /**
   * 2026-08-12 — 배포 룰 본문. **codex 와 같은 파일**(프로젝트 루트 `AGENTS.md`)을 쓰므로 두
   * 렌더러가 같은 값을 넣어야 한다 — 한쪽만 넣으면 나중에 도는 transform 이 룰을 지운다.
   */
  harnessRules?: string;
}

/**
 * Render the OpenCode AGENTS.md output by embedding the full CLAUDE.md body.
 *
 * Placeholders (matches templates/opencode/AGENTS.md.template):
 *   - {PROJECT_NAME} — basename of project dir
 *   - {PROJECT_RULES} — full CLAUDE.md body (first h1 stripped)
 *   - {PROJECT_CONTEXT} — project-specific fill scaffold (renderFillScaffold())
 */
export function renderAgentsMd(params: AgentsMdParams): string {
  const body = params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
  const replaced = params.template
    .replaceAll("{PROJECT_NAME}", params.projectName)
    .replaceAll("{PROJECT_RULES}", body)
    .replaceAll("{PROJECT_CONTEXT}", params.projectContext)
    .replaceAll("{HARNESS_RULES}", params.harnessRules ?? "");
  return renameSlashes(replaced);
}
