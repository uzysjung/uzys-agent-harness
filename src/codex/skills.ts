/**
 * Bundled SKILL.md → non-Claude CLI native skill transform (dev-method skills).
 */
import { renameSlashes } from "./agents-md.js";

/**
 * v26.87.0 — render a bundled, already-complete SKILL.md (dev-method skills) for a
 * non-Claude CLI (Codex / Antigravity native `.agents/skills/<id>/SKILL.md`).
 *
 * These sources are full Anthropic skills with their OWN frontmatter (`name: <id>`,
 * full description). We MUST preserve that frontmatter verbatim — only the BODY is
 * ported: `/uzys:` → `/uzys-` slash rename + `CLAUDE_PROJECT_DIR` → `CODEX_PROJECT_DIR`
 * env-var rename (Codex/Antigravity share the `.agents/` format + `CODEX_PROJECT_DIR`).
 */
export function renderBundledSkill(source: string): string {
  const trimmed = source.trimEnd();
  const lines = trimmed.split(/\r?\n/);
  // No frontmatter → emit body as-is (port slashes/env only). Defensive: bundled
  // dev-method skills always have frontmatter, but never silently drop content.
  if (lines[0] !== "---") {
    return `${portBody(trimmed)}\n`;
  }
  let secondDelimAt = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      secondDelimAt = i;
      break;
    }
  }
  if (secondDelimAt < 0) {
    // Malformed frontmatter (no closing ---) → port whole thing as body.
    return `${portBody(trimmed)}\n`;
  }
  const frontmatter = lines.slice(0, secondDelimAt + 1).join("\n");
  const body = lines.slice(secondDelimAt + 1).join("\n");
  return `${frontmatter}\n${portBody(body)}\n`;
}

/** Port a skill body for Codex/Antigravity: slash + project-dir env-var rename. */
function portBody(body: string): string {
  return renameSlashes(body)
    .replace(/CLAUDE_PROJECT_DIR/g, "CODEX_PROJECT_DIR")
    .trimEnd();
}
