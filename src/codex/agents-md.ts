/**
 * AGENTS.md transform — CLAUDE.md → AGENTS.md.
 *
 * v26.70.0 — section 추출(Identity/Direction/Principles) → CLAUDE.md **전문 embed**.
 *   실 `templates/CLAUDE.md` 에 Identity/Direction/Principles 헤딩이 없어
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
  /** Project-context fill scaffold — the same body shipped to the Claude Code CLAUDE.md. */
  projectContext: string;
  /**
   * 2026-08-12 — 배포 룰 본문(이어 붙인 한 덩어리). **Codex 전용**이다: Codex 는 룰 디렉터리가
   * 없고 `AGENTS.md` 계층만 읽으므로 룰이 본문에 들어가야 도달한다. OpenCode · Antigravity 는
   * 각자 룰 디렉터리를 쓰므로 이 값을 넘기지 않고, 그 템플릿에는 placeholder 도 없다.
   */
  harnessRules?: string;
}

/**
 * Render AGENTS.md by embedding the full CLAUDE.md body into the template.
 *
 * Placeholders:
 *   - {PROJECT_NAME} — basename of project dir
 *   - {PROJECT_RULES} — full CLAUDE.md body (first h1 stripped; template provides its own h1)
 *   - {PROJECT_CONTEXT} — project-specific fill scaffold (renderFillScaffold())
 *
 * 마지막에 `/uzys:` → `/uzys-` rename (Codex/Antigravity 는 slash namespace 미지원).
 */
export function renderAgentsMd(params: AgentsMdParams): string {
  // CLAUDE.md 의 첫 h1 (# title) 제거 — 템플릿이 자체 h1 보유.
  const body = params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
  const replaced = params.template
    .replaceAll("{PROJECT_NAME}", params.projectName)
    .replaceAll("{PROJECT_RULES}", body)
    .replaceAll("{PROJECT_CONTEXT}", params.projectContext)
    .replaceAll("{HARNESS_RULES}", params.harnessRules ?? "");
  return renameSlashes(replaced);
}
